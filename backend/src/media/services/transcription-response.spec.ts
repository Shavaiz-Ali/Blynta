import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TranscriptionService } from './transcription.service';
import { ProcessRegistryService } from '../../common/services/process-registry.service';
import * as runner from '../utils/run-command-with-progress';

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
          create: jest
            .fn()
            .mockResolvedValue({
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
