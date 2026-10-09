import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UnrecoverableError } from 'bullmq';
import { VideoDownloadService } from './video-download.service';
import { SourceAuthorizationError } from '../../billing/source-authorization';
import { runCommandWithProgress } from '../utils/run-command-with-progress';
jest.mock('../utils/run-command-with-progress', () => ({
  runCommandWithProgress: jest.fn(),
}));

describe('download preflight authorization failure', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'blynta-preflight-'));
    jest.clearAllMocks();
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });
  function service(duration: number) {
    const downloader = new VideoDownloadService(
      { get: jest.fn() } as never,
      {} as never,
    );
    jest.spyOn(downloader, 'fetchVideoMetadata').mockResolvedValue({
      duration,
      title: '',
      uploader: '',
      thumbnailUrl: '',
    });
    return downloader;
  }
  it('metadata genuine overage is nonretryable before any download/extraction command', async () => {
    await expect(
      service(3234).downloadVideo(
        'https://youtu.be/video',
        root,
        '240p',
        undefined,
        3233,
      ),
    ).rejects.toBeInstanceOf(SourceAuthorizationError);
    expect(runCommandWithProgress).not.toHaveBeenCalled();
  });
  it.each([3233, 3233.461])(
    'metadata %s defers final authorization to the measured duration and saved pricing',
    async (duration) => {
      jest
        .mocked(runCommandWithProgress)
        .mockRejectedValue(new Error('test: download started'));
      await expect(
        service(duration).downloadVideo(
          'https://youtu.be/video',
          root,
          '240p',
          undefined,
          3233,
        ),
      ).rejects.toThrow('download started');
      expect(runCommandWithProgress).toHaveBeenCalledTimes(1);
    },
  );
  it.each([0, NaN, Infinity])(
    'invalid metadata %s stops before downloading',
    async (duration) => {
      await expect(
        service(duration).downloadVideo(
          'https://youtu.be/video',
          root,
          '240p',
          undefined,
          3233,
        ),
      ).rejects.toBeInstanceOf(UnrecoverableError);
      expect(runCommandWithProgress).not.toHaveBeenCalled();
    },
  );
});
