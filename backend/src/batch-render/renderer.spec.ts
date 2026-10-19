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
      objectInfo: jest.fn(async () => ({ size: uploaded.length })),
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
  const run = () =>
    runRenderer(
      `${prefix}/task.json`,
      'aws-1',
      new ConfigService({
        R2_BUCKET_NAME: 'output',
        R2_SOURCE_BUCKET_NAME: 'private',
        R2_ENDPOINT: 'https://r2.invalid',
      }),
      r2,
    );
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
