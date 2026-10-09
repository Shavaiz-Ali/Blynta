import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JobsProcessor } from './jobs.processor';
import { JOBS_TYPES } from './jobs.constants';
import { JobStatus, SourcePlatform } from './schemas/job.schema';
import {
  sourceDurationAuthorized,
  SourceAuthorizationError,
} from '../billing/source-authorization';
import { INITIAL_PRICING } from '../billing/credit-pricing';
jest.mock('../media/services/highlight-detection.service', () => ({
  HighlightDetectionService: class {},
}));
jest.mock('../media/services/transcription.service', () => ({
  TranscriptionService: class {},
}));

describe('pipeline source validation before paid work', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'blynta-budget-'));
    await writeFile(join(root, 'source.mp4'), 'fixture');
    await writeFile(join(root, 'audio.wav'), 'fixture');
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });
  function fixture(measured: number, cached = false, plan = 'pro') {
    const op = {
      product: 'ai-clips' as const,
      sourceSeconds: 3233,
      maxOutputSeconds: 540,
      authorized: 20,
      pricing: INITIAL_PRICING,
    };
    const parent = {
      userId: 'user',
      sourceUrl: 'https://youtu.be/video',
      sourcePlatform: SourcePlatform.YOUTUBE,
      status: JobStatus.PENDING,
      creditSourceSeconds: 3233,
      videoDuration: 3233,
    };
    const jobs = {
      findJob: jest.fn(() => Promise.resolve({ ...parent })),
      updateJob: jest.fn((_id: string, values: object) =>
        Promise.resolve({ ...Object.assign(parent, values) }),
      ),
      runMediaExecution: jest.fn((_id: string, work: () => Promise<void>) =>
        work(),
      ),
      assertSourceBudget: jest.fn((_id: string, duration: number) => {
        if (!sourceDurationAuthorized(op, duration))
          return Promise.reject(
            new SourceAuthorizationError(op.sourceSeconds, duration),
          );
        return Promise.resolve();
      }),
    };
    const stop = new Error('test: stop after approved source');
    const download = {
      canShareSource: jest.fn().mockResolvedValue(true),
      extractAudio: jest.fn((_video: string, audio: string) =>
        writeFile(audio, 'fixture'),
      ),
      downloadVideo: jest.fn(() =>
        Promise.resolve({
          videoPath: join(root, 'source.mp4'),
          audioPath: join(root, 'audio.wav'),
          duration: 3233,
        }),
      ),
    };
    const transcribe = { transcribe: jest.fn().mockRejectedValue(stop) };
    const highlight = {
      detectHighlightsWithMetadata: jest.fn().mockRejectedValue(stop),
    };
    const sources = {
      extractExternalId: () => 'video',
      findCached: () =>
        Promise.resolve(
          cached
            ? {
                _id: 'cache',
                videoObjectKey: 'video.mp4',
                audioObjectKey: 'audio.wav',
                videoDuration: 3233,
                transcript: [],
              }
            : null,
        ),
      recordReuse: jest.fn(),
      saveMediaMetadata: jest.fn(),
      saveAudio: jest.fn(),
      saveTranscript: jest.fn(),
      createFromProcessing: jest.fn((params: object) =>
        Promise.resolve({ _id: 'cache', ...params }),
      ),
    };
    const r2 = {
      downloadToLocal: jest.fn((_key: string, dest: string) =>
        writeFile(dest, 'fixture'),
      ),
      fileExists: () => Promise.resolve(false),
      uploadFile: jest.fn(),
    };
    const inspection = {
      inspect: jest.fn(() =>
        Promise.resolve({
          durationSeconds: measured,
          hasVideo: true,
          hasAudio: true,
          width: 640,
          height: 360,
          fps: 30,
        }),
      ),
    };
    const completion = { publish: jest.fn() };
    const processor = new JobsProcessor(
      jobs as never,
      { findById: () => Promise.resolve({ plan }) } as never,
      {
        get: (_key: string, fallback: unknown) =>
          _key === 'STORAGE_ROOT' ? root : fallback,
      } as never,
      download as never,
      transcribe as never,
      highlight as never,
      sources as never,
      r2 as never,
      inspection as never,
      completion as never,
      { queueCreateIfNotExists: jest.fn() } as never,
    );
    Object.assign(processor, {
      logger: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    });
    const bull = {
      name: JOBS_TYPES.CLIP_VIDEO,
      data: { jobId: 'job' },
      attemptsMade: 0,
      timestamp: Date.now(),
      getState: () => Promise.resolve('failed'),
    };
    return {
      processor,
      bull,
      parent,
      jobs,
      download,
      transcribe,
      r2,
      inspection,
      highlight,
      completion,
    };
  }
  it.each([false, true])(
    'genuine overage is terminal before AI/upload and cached=%s does not fall back',
    async (cached) => {
      const f = fixture(3234, cached);
      let error!: SourceAuthorizationError;
      try {
        await f.processor.process(f.bull as never);
      } catch (caught) {
        error = caught as SourceAuthorizationError;
      }
      expect(error).toBeInstanceOf(SourceAuthorizationError);
      expect(f.transcribe.transcribe).not.toHaveBeenCalled();
      expect(f.r2.uploadFile).not.toHaveBeenCalled();
      expect(f.download.downloadVideo).toHaveBeenCalledTimes(cached ? 0 : 1);
      expect(f.parent).toMatchObject({ measuredSourceSeconds: 3234 });
      await f.processor.onFailed(f.bull as never, error);
      expect(f.parent.status).toBe(JobStatus.FAILED);
      expect(f.completion.publish).toHaveBeenCalledWith('job');
    },
  );
  it.each([3233, 3233.461])(
    'valid duration %s reaches transcription with ffprobe duration retained',
    async (measured) => {
      const f = fixture(measured);
      await expect(f.processor.process(f.bull as never)).rejects.toThrow(
        'stop after approved source',
      );
      expect(f.jobs.assertSourceBudget).toHaveBeenCalledWith('job', measured);
      expect(f.transcribe.transcribe).toHaveBeenCalledTimes(1);
      expect(f.parent.videoDuration).toBe(measured);
      expect(f.parent.creditSourceSeconds).toBe(3233);
    },
  );
  it('cached source is remeasured and its coarse cached duration cannot overwrite ffprobe', async () => {
    const f = fixture(3233.461, true);
    await expect(f.processor.process(f.bull as never)).rejects.toThrow(
      'stop after approved source',
    );
    expect(f.inspection.inspect).toHaveBeenCalledTimes(2);
    expect(f.download.downloadVideo).not.toHaveBeenCalled();
    expect(f.parent.videoDuration).toBe(3233.461);
    expect(f.transcribe.transcribe).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])(
    'partial/full resume (%s) cannot bypass validation using stored coarse metadata',
    async (full) => {
      const f = fixture(3234);
      const localVideoPath = join(root, 'resume.mp4');
      const localAudioPath = join(root, 'resume.wav');
      await writeFile(localVideoPath, 'fixture');
      await writeFile(localAudioPath, 'fixture');
      Object.assign(f.parent, {
        localVideoPath,
        localAudioPath,
        transcript: full ? [{ startTime: 0, endTime: 1, text: 'saved' }] : [],
        mediaMetadata: { durationSeconds: 3233, hasVideo: true },
      });
      await expect(f.processor.process(f.bull as never)).rejects.toBeInstanceOf(
        SourceAuthorizationError,
      );
      expect(f.download.downloadVideo).not.toHaveBeenCalled();
      expect(f.transcribe.transcribe).not.toHaveBeenCalled();
      expect(f.inspection.inspect).toHaveBeenCalledWith(localVideoPath);
    },
  );
  it.each([
    ['free', 6, 360],
    ['pro', 9, 540],
    ['business', 9, 540],
  ])(
    'passes %s policy and immutable authorization to detection, then resumes without another call',
    async (plan, max, budget) => {
      const f = fixture(3233.461, false, plan);
      const localVideoPath = join(root, 'resume.mp4');
      await writeFile(localVideoPath, 'fixture');
      const highlights = Array.from({ length: max }, (_, i) => ({
        startTime: i * 80,
        endTime: i * 80 + 45,
        score: 0.9,
        reason: 'Complete moment',
        clipTitle: 'Clip ' + i,
        clipDescription: '',
        tags: [],
        style: 'curiosity-hook',
      }));
      Object.assign(f.parent, {
        localVideoPath,
        transcript: [
          { startTime: 0, endTime: 3233, text: 'Complete saved transcript' },
        ],
        creditOperationId: 'operation',
        creditOutputSeconds: budget,
        clipTargetMax: max,
        clips: [],
      });
      const prepareRenderManifest = jest.fn(() => {
        Object.assign(f.parent, {
          renderManifestReady: true,
          clips: highlights,
        });
        return Promise.resolve();
      });
      Object.assign(f.jobs, {
        prepareRenderManifest,
        enqueueRenders: jest.fn().mockResolvedValue(undefined),
      });
      Object.assign(f.completion, {
        finalize: jest.fn().mockResolvedValue(undefined),
      });
      f.highlight.detectHighlightsWithMetadata.mockResolvedValue({
        highlights,
      });
      await f.processor.process(f.bull as never);
      expect(f.highlight.detectHighlightsWithMetadata).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          plan,
          jobId: 'job',
          maxHighlights: max,
          minHighlights: 0,
          maxOutputSeconds: budget,
        }),
      );
      expect(prepareRenderManifest).toHaveBeenCalledWith('job', highlights);
      await f.processor.process(f.bull as never);
      expect(f.highlight.detectHighlightsWithMetadata).toHaveBeenCalledTimes(1);
      expect(prepareRenderManifest).toHaveBeenCalledTimes(1);
      expect(f.parent).toMatchObject({
        creditOperationId: 'operation',
        creditOutputSeconds: budget,
      });
    },
  );
});
