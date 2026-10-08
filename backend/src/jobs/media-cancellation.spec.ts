import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { ReadStream } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { R2Service } from '../storage/r2.service';
import { TranscriptionService } from '../media/services/transcription.service';
import { ProcessRegistryService } from '../common/services/process-registry.service';
import { mediaExecution } from './cancellation-context';

describe('provider cancellation closes source file readers', () => {
  let directory: string;
  let inputPath: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'blynta-upload-cancel-'));
    inputPath = join(directory, 'input.wav');
    await writeFile(inputPath, 'audio');
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  it('passes the execution signal to R2 and waits for the upload file reader to close', async () => {
    const service = new R2Service(
      new ConfigService({ R2_BUCKET_NAME: 'test' }),
    );
    const controller = new AbortController();
    let reader: ReadStream | undefined;
    const send = jest.fn(
      (command: PutObjectCommand, options: { abortSignal?: AbortSignal }) => {
        reader = command.input.Body as ReadStream;
        expect(options.abortSignal).toBe(controller.signal);
        return new Promise<void>((_resolve, reject) =>
          options.abortSignal!.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          ),
        );
      },
    );
    Reflect.set(service, 'client', { send });
    const work = mediaExecution.run(
      { signal: controller.signal, children: new Set() },
      () => service.uploadFile(inputPath, 'clip'),
    );
    const rejection = expect(work).rejects.toThrow('aborted');
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    await rejection;
    expect(send).toHaveBeenCalledTimes(1);
    expect(reader?.closed).toBe(true);
  });
  it('passes the execution signal to Groq and closes its reader before acknowledging cancellation', async () => {
    const service = new TranscriptionService(
      new ConfigService({
        TRANSCRIPTION_PROVIDER: 'groq',
        GROQ_API_KEY: 'test',
      }),
      new ProcessRegistryService(),
    );
    const controller = new AbortController();
    let reader: ReadStream | undefined;
    const create = jest.fn(
      (request: { file: ReadStream }, options: { signal?: AbortSignal }) => {
        reader = request.file;
        expect(options.signal).toBe(controller.signal);
        return new Promise<void>((_resolve, reject) =>
          options.signal!.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          ),
        );
      },
    );
    Reflect.set(service, 'groq', { audio: { transcriptions: { create } } });
    const work = mediaExecution.run(
      { signal: controller.signal, children: new Set() },
      () => service.transcribe(inputPath),
    );
    const rejection = expect(work).rejects.toThrow('Processing cancelled');
    // stat() precedes the request; wait until the mock has acquired the reader.
    while (!reader) await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    await rejection;
    expect(create).toHaveBeenCalledTimes(1);
    expect(reader.closed).toBe(true);
  });
});
