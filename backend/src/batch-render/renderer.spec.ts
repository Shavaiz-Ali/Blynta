/* Mock database/storage boundaries intentionally use partial objects. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { readFile, writeFile } from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import { runRenderer } from './renderer';
import { ClipCuttingService } from '../media/services/clip-cutting.service';
import { CaptionBurningService } from '../media/services/caption-burning.service';
import { MediaInspectionService } from '../media/services/media-inspection.service';
import { runCommandWithProgress } from '../media/utils/run-command-with-progress';
import { join } from 'node:path';
import { UnrecoverableError } from 'bullmq';

jest.mock('../media/utils/run-command-with-progress');
describe('one-shot renderer', () => {
  const prefix = `job-sources/batch/${'a'.repeat(64)}`;
  let task: any;
  let r2: any;
  let uploaded: Buffer;
  beforeEach(() => {
    task = {
      version: 1,
      kind: 'clip',
      outputKey: `${prefix}/output.mp4`,
      deadline: Date.now() + 60000,
      sourceKey: 'job-sources/parent/source.mp4',
      start: 10,
      end: 20,
      segments: [{ startTime: 0, endTime: 2, text: 'Caption' }],
      style: { fontFamily: 'Montserrat' },
    };
    r2 = {
      downloadToBuffer: jest.fn(async () => Buffer.from(JSON.stringify(task))),
      getSignedDownloadUrl: jest.fn(
        async () => 'https://private.example/source?signature=secret',
      ),
      downloadToLocal: jest.fn(async (_key, path) =>
        writeFile(path, 'staged-input'),
      ),
      uploadFile: jest.fn(async (path) => {
        uploaded = await readFile(path);
      }),
      uploadBuffer: jest.fn(async () => {}),
      objectInfo: jest.fn(async (key) => ({
        size: key === task.sourceKey ? 123 : uploaded.length,
      })),
    };
    jest
      .spyOn(ClipCuttingService.prototype, 'cutClip')
      .mockImplementation(async (_src, _start, _end, path) => {
        await writeFile(path, 'cut');
        return path;
      });
    jest
      .spyOn(CaptionBurningService.prototype, 'burnCaptions')
      .mockImplementation(async (_src, _segments, path) => {
        await writeFile(path, 'captioned');
        return path;
      });
    jest.spyOn(MediaInspectionService.prototype, 'inspect').mockResolvedValue({
      durationSeconds: 10,
      hasVideo: true,
      hasAudio: true,
    });
    jest
      .mocked(runCommandWithProgress)
      .mockImplementation(async (_cmd, _args, _onLine, _registry, options) => {
        await writeFile(join(options!.cwd!, 'output.mp4'), 'edited');
      });
  });
  afterEach(() => jest.restoreAllMocks());
  const run = (buckets: Record<string, string> = {}) =>
    runRenderer(
      `${prefix}/task.json`,
      'aws-1',
      new ConfigService({
        R2_BUCKET_NAME: 'output',
        R2_SOURCE_BUCKET_NAME: 'private',
        R2_ENDPOINT: 'https://r2.invalid',
        ...buckets,
      }),
      r2,
    );
  it('runs a single-bucket clip using existing source keys and private task/output paths', async () => {
    task.sourceKey = 'source-videos/existing/video.mp4';
    await run({ R2_BUCKET_NAME: 'blynta', R2_SOURCE_BUCKET_NAME: 'blynta' });
    expect(r2.objectInfo).toHaveBeenCalledWith(task.sourceKey);
    expect(r2.getSignedDownloadUrl).toHaveBeenCalledWith(
      task.sourceKey,
      expect.any(Number),
    );
    expect(r2.uploadFile).toHaveBeenCalledWith(
      expect.any(String),
      `${prefix}/output.mp4`,
    );
    expect(r2.uploadBuffer.mock.calls.map((call) => call[1])).toEqual(
      expect.arrayContaining([
        `${prefix}/progress.json`,
        `${prefix}/result.json`,
      ]),
    );
    expect(
      r2.uploadBuffer.mock.calls.some((call) => call[1] === task.sourceKey),
    ).toBe(false);
  });
  it('rejects unsafe endpoints before downloading a manifest', async () => {
    await expect(
      run({ R2_ENDPOINT: 'http://r2.invalid' }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(r2.downloadToBuffer).not.toHaveBeenCalled();
  });
  it.each(['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'])(
    'rejects empty injected %s at startup before creating a real R2 client',
    async (name) => {
      const config = new ConfigService({
        R2_BUCKET_NAME: 'blynta',
        R2_SOURCE_BUCKET_NAME: 'blynta',
        R2_ENDPOINT: 'https://r2.invalid',
        R2_ACCESS_KEY_ID: 'test-access',
        R2_SECRET_ACCESS_KEY: 'test-secret',
        [name]: '',
      });
      await expect(
        runRenderer(`${prefix}/task.json`, 'aws-1', config),
      ).rejects.toThrow(name);
      expect(r2.downloadToBuffer).not.toHaveBeenCalled();
    },
  );
  it.each(['output.mp4', 'task.json', 'progress.json', 'result.json'])(
    'rejects a source collision with %s inside the container before writes',
    async (name) => {
      task.sourceKey = `${prefix}/${name}`;
      await expect(run()).rejects.toBeInstanceOf(UnrecoverableError);
      expect(r2.getSignedDownloadUrl).not.toHaveBeenCalled();
      expect(r2.uploadFile).not.toHaveBeenCalled();
      expect(r2.uploadBuffer).not.toHaveBeenCalled();
    },
  );
  it('treats missing source objects as permanent and never publishes a result', async () => {
    r2.objectInfo.mockRejectedValueOnce(
      Object.assign(new Error('missing'), {
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 },
      }),
    );
    await expect(run()).rejects.toBeInstanceOf(UnrecoverableError);
    expect(ClipCuttingService.prototype.cutClip).not.toHaveBeenCalled();
    expect(r2.uploadFile).not.toHaveBeenCalled();
    expect(r2.uploadBuffer).not.toHaveBeenCalled();
  });
  it.each([
    new Error('network timeout'),
    Object.assign(new Error('R2 unavailable'), {
      $metadata: { httpStatusCode: 503 },
    }),
  ])('keeps temporary storage failures retryable', async (error) => {
    r2.objectInfo.mockRejectedValueOnce(error);
    await expect(run()).rejects.toBe(error);
    expect(error).not.toBeInstanceOf(UnrecoverableError);
    expect(r2.uploadFile).not.toHaveBeenCalled();
  });
  it('reuses cutting/caption services and seeks a signed source without downloading the full video', async () => {
    await run();
    expect(ClipCuttingService.prototype.cutClip).toHaveBeenCalledWith(
      expect.stringContaining('https://private.'),
      10,
      20,
      expect.any(String),
      expect.any(Function),
    );
    expect(CaptionBurningService.prototype.burnCaptions).toHaveBeenCalledWith(
      expect.any(String),
      task.segments,
      expect.any(String),
      task.style,
      10,
      expect.any(Function),
    );
    expect(r2.downloadToLocal).not.toHaveBeenCalled();
    expect(uploaded.toString()).toBe('captioned');
    const result = r2.uploadBuffer.mock.calls.find((c) =>
      c[1].endsWith('/result.json'),
    );
    expect(JSON.parse(result[0].toString())).toMatchObject({
      jobId: 'aws-1',
      bytes: 9,
      outputKey: task.outputKey,
    });
  });
  it('supports clips without captions', async () => {
    task.segments = [];
    await run();
    expect(CaptionBurningService.prototype.burnCaptions).not.toHaveBeenCalled();
    expect(uploaded.toString()).toBe('cut');
  });
  it('never publishes a marker on FFmpeg failure', async () => {
    jest
      .mocked(ClipCuttingService.prototype.cutClip)
      .mockRejectedValueOnce(new Error('ffmpeg failed'));
    await expect(run()).rejects.toThrow('ffmpeg failed');
    expect(r2.uploadFile).not.toHaveBeenCalled();
    expect(
      r2.uploadBuffer.mock.calls.some((c) => c[1].endsWith('/result.json')),
    ).toBe(false);
  });
  it('never publishes invalid media', async () => {
    jest
      .mocked(MediaInspectionService.prototype.inspect)
      .mockResolvedValueOnce({
        durationSeconds: 1,
        hasVideo: false,
        hasAudio: false,
      });
    await expect(run()).rejects.toThrow('media verification');
    expect(r2.uploadFile).not.toHaveBeenCalled();
  });
  it('executes staged edit arguments through the existing FFmpeg utility', async () => {
    task = {
      version: 1,
      kind: 'edit',
      outputKey: task.outputKey,
      deadline: task.deadline,
      duration: 10,
      files: [
        {
          name: 'source.mp4',
          key: `${prefix}/inputs/source.mp4`,
          size: 12,
          etag: 'etag',
        },
      ],
      args: ['-i', 'source.mp4', 'output.mp4'],
    };
    await run();
    expect(r2.downloadToLocal).toHaveBeenCalledWith(
      task.files[0].key,
      expect.stringContaining('source.mp4'),
      { maxBytes: 12, etag: 'etag' },
    );
    expect(runCommandWithProgress).toHaveBeenCalledWith(
      'ffmpeg',
      task.args,
      expect.any(Function),
      expect.anything(),
      { cwd: expect.any(String) },
    );
    expect(uploaded.toString()).toBe('edited');
  });
  it('rejects path traversal and expired manifests', async () => {
    task.kind = 'edit';
    task.files = [{ name: '../escape', key: `${prefix}/inputs/file`, size: 5 }];
    await expect(run()).rejects.toThrow('Invalid staged input');
    task.deadline = 0;
    await expect(run()).rejects.toThrow('expired');
  });
});
