import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TranscriptionService } from './transcription.service';
import { ProcessRegistryService } from '../../common/services/process-registry.service';
import * as runner from '../utils/run-command-with-progress';
import Groq from 'groq-sdk';
import { UnrecoverableError } from 'bullmq';

const mockFetch = (response: () => Response) =>
  jest.fn(() => Promise.resolve().then(response));

describe('provider output ownership and normalization', () => {
  let directory: string;
  let audio: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'blynta-transcript-'));
    audio = join(directory, 'audio.wav');
    await writeFile(audio, 'audio');
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });
  const service = (provider: 'groq' | 'whisper-cpp') =>
    new TranscriptionService(
      new ConfigService({
        TRANSCRIPTION_PROVIDER: provider,
        GROQ_API_KEY: 'test',
        WHISPER_BINARY_PATH: 'whisper',
        WHISPER_MODEL_PATH: 'model.bin',
      }),
      new ProcessRegistryService(),
    );

  test('valid text-only Groq response produces a positive measured interval', async () => {
    const s = service('groq');
    const create = jest
      .fn()
      .mockResolvedValue({ text: ' Hello ', segments: [] });
    Reflect.set(s, 'groq', { audio: { transcriptions: { create } } });
    expect(await s.transcribe(audio, undefined, undefined, 5)).toEqual([
      { startTime: 0, endTime: 5, text: 'Hello' },
    ]);
    expect(create.mock.calls[0][0]).toMatchObject({
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });
  });
  test('malformed Groq response preserves safe structured errors', async () => {
    const s = service('groq');
    Reflect.set(s, 'groq', {
      audio: {
        transcriptions: {
          create: jest.fn().mockResolvedValue({
            segments: [{ start: 0, end: 0, text: 'secret' }],
          }),
        },
      },
    });
    await expect(
      s.transcribe(audio, undefined, undefined, 5),
    ).rejects.toMatchObject({
      code: 'INVALID_TRANSCRIPT_ARTIFACT',
      details: { reason: 'non_positive_segment_duration', segmentIndex: 0 },
    });
  });
  test.each([429, 503, 'connection'] as const)(
    'SDK owns retries for %s; exhausted requests stop BullMQ retry multiplication',
    async (failure) => {
      const s = service('groq');
      const client = Reflect.get(s, 'groq') as Groq;
      expect(client.maxRetries).toBe(2);
      const fetch = mockFetch(() => {
        if (failure === 'connection') throw new Error('connection lost');
        return new Response(
          JSON.stringify({ error: { message: 'private provider content' } }),
          {
            status: failure,
            headers: {
              'content-type': 'application/json',
              'retry-after-ms': '1',
            },
          },
        );
      });
      // Supply the native Response constructor so the SDK's data: capability
      // probe is not counted as a transcription API request.
      Reflect.set(fetch, 'Response', Response);
      Reflect.set(client, 'fetch', fetch);
      const result = s.transcribe(audio, undefined, undefined, 5, 'job-test');
      await expect(result).rejects.toBeInstanceOf(UnrecoverableError);
      await expect(result).rejects.not.toThrow('private provider content');
      expect(fetch).toHaveBeenCalledTimes(3);
    },
  );
  test('normalizes a successful provider response once and logs raw timing with job context', async () => {
    const s = service('groq');
    const warn = jest.spyOn(Reflect.get(s, 'logger'), 'warn');
    const fetch = mockFetch(
      () =>
        new Response(
          JSON.stringify({
            segments: [
              { start: 0, end: 1, text: 'one' },
              { start: 1, end: 1, text: 'two' },
            ],
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
    );
    Reflect.set(fetch, 'Response', Response);
    Reflect.set(Reflect.get(s, 'groq'), 'fetch', fetch);
    expect(
      await s.transcribe(audio, undefined, undefined, 5, 'job-test'),
    ).toEqual([{ startTime: 0, endTime: 1, text: 'one two' }]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'transcript.segment.invalid',
        jobId: 'job-test',
        rawStart: 1,
        rawEnd: 1,
      }),
    );
  });
  test('non-retryable provider rejection and corrupt successful output each make one request', async () => {
    for (const status of [401, 200]) {
      const s = service('groq');
      const fetch = mockFetch(
        () =>
          new Response(
            JSON.stringify(
              status === 401
                ? { error: { message: 'secret' } }
                : { segments: [{ start: 0, end: 0, text: 'secret' }] },
            ),
            {
              status,
              headers: { 'content-type': 'application/json' },
            },
          ),
      );
      Reflect.set(fetch, 'Response', Response);
      Reflect.set(Reflect.get(s, 'groq'), 'fetch', fetch);
      await expect(
        s.transcribe(audio, undefined, undefined, 5),
      ).rejects.toBeInstanceOf(UnrecoverableError);
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });
  test('does not read stale output after interrupted or missing Whisper output', async () => {
    await writeFile(
      join(directory, 'audio.json'),
      JSON.stringify({
        transcription: [{ offsets: { from: 0, to: 1000 }, text: 'old speech' }],
      }),
    );
    const run = jest
      .spyOn(runner, 'runCommandWithProgress')
      .mockRejectedValueOnce(new Error('Whisper interrupted'));
    await expect(
      service('whisper-cpp').transcribe(audio, undefined, undefined, 5),
    ).rejects.toThrow('Whisper interrupted');
    run.mockResolvedValueOnce(undefined);
    await expect(
      service('whisper-cpp').transcribe(audio, undefined, undefined, 5),
    ).rejects.toThrow('missing_or_malformed_provider_output');
    expect(await readdir(directory)).toContain('audio.json');
  });
  test.each(['valid', 'partial'] as const)(
    'reads only invocation-owned %s JSON and cleans it',
    async (mode) => {
      jest
        .spyOn(runner, 'runCommandWithProgress')
        .mockImplementation(async (_bin, args) => {
          const base = args[args.indexOf('-of') + 1];
          expect(base).not.toBe(audio.replace(/\.wav$/, ''));
          await writeFile(
            `${base}.json`,
            mode === 'partial'
              ? '{"transcription":['
              : JSON.stringify({
                  transcription: [
                    { offsets: { from: 0, to: 1000 }, text: 'current speech' },
                  ],
                }),
          );
        });
      const result = service('whisper-cpp').transcribe(
        audio,
        undefined,
        undefined,
        5,
      );
      if (mode === 'partial')
        await expect(result).rejects.toThrow(
          'missing_or_malformed_provider_output',
        );
      else
        expect(await result).toEqual([
          { startTime: 0, endTime: 1, text: 'current speech' },
        ]);
      expect(
        (await readdir(directory)).filter((name) =>
          name.startsWith('transcript-'),
        ),
      ).toEqual([]);
    },
  );
});
