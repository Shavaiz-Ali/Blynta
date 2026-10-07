import { ClipRenderProgress } from './render-progress';
import { ConfigService } from '@nestjs/config';
import { Job as BullJob } from 'bullmq';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Types } from 'mongoose';
import { RenderProcessor } from './render.processor';
import { RenderCapacityService } from './render-capacity.service';
import { RenderSourceService } from './render-source.service';
import { JobsService } from './jobs.service';
import { JobsCompletionService } from './jobs-completion.service';
import { R2Service } from '../storage/r2.service';
import { CaptionBurningService } from '../media/services/caption-burning.service';
import { ClipCuttingService } from '../media/services/clip-cutting.service';
import {
  Job,
  Clip,
  JobStatus,
  ClipProcessingState,
} from './schemas/job.schema';
import { FfmpegProgress } from '../media/utils/ffmpeg-progress';
import { RENDER_CLIP } from './jobs.constants';

describe('independent clip processor lifecycle', () => {
  let directory: string;
  let processor: RenderProcessor;
  let sources: RenderSourceService;
  const parents = new Map<string, Job>();
  const jobs = {
    failUnfinishedClip: jest.fn(
      (id: string, clipId: string, message: string, stage: string) => {
        const clip = parents
          .get(id)
          ?.clips.find((c) => c._id.toString() === clipId);
        if (clip && clip.status !== JobStatus.COMPLETED)
          Object.assign(clip, {
            status: JobStatus.FAILED,
            processingState: ClipProcessingState.FAILED,
            errorMessage: message,
            errorStage: stage,
          });
        return Promise.resolve();
      },
    ),
    findJob: jest.fn((id: string) => Promise.resolve(parents.get(id))),
    updateClip: jest.fn((id: string, clipId: string, update: Partial<Clip>) => {
      const clip = parents
        .get(id)
        ?.clips.find((c) => c._id.toString() === clipId);
      if (clip) Object.assign(clip, update);
      return Promise.resolve();
    }),
  };
  const completion = {
    finalize: jest.fn((id: string) => {
      const job = parents.get(id)!;
      if (
        job.clips.every((c) =>
          [JobStatus.COMPLETED, JobStatus.FAILED].includes(c.status),
        )
      ) {
        job.status = job.clips.some((c) => c.status === JobStatus.FAILED)
          ? JobStatus.FAILED
          : JobStatus.COMPLETED;
      }
      return Promise.resolve();
    }),
  };
  const r2 = {
    fileExists: jest.fn(() => Promise.resolve(false)),
    downloadToLocal: jest.fn(async (_key: string, path: string) =>
      writeFile(path, 'source'),
    ),
    uploadFile: jest.fn((_path: string, key: string) => Promise.resolve(key)),
  };
  const cutting = {
    cutClip: jest.fn(
      async (
        _source: string,
        _start: number,
        _end: number,
        path: string,
        publish: (p: FfmpegProgress) => void,
      ) => {
        publish({
          progress: 50,
          processedSeconds: 5,
          durationSeconds: 10,
          speed: 1,
          etaSeconds: 5,
        });
        await writeFile(path, 'clip');
        return path;
      },
    ),
  };
  const captions = {
    burnCaptions: jest.fn(
      async (
        _source: string,
        _segments: unknown,
        path: string,
        _style: unknown,
        _duration: number,
        publish: (p: FfmpegProgress) => void,
      ) => {
        publish({
          progress: 80,
          processedSeconds: 8,
          durationSeconds: 10,
          speed: 2,
          etaSeconds: 1,
        });
        await writeFile(path, 'captioned');
        return path;
      },
    ),
  };
  const create = (id: string, count = 1) => {
    const clips = Array.from(
      { length: count },
      (_, index) =>
        ({
          _id: new Types.ObjectId(),
          startTime: index * 10,
          endTime: (index + 1) * 10,
          status: JobStatus.PENDING,
          processingState: ClipProcessingState.QUEUED,
        }) as Clip,
    );
    parents.set(id, {
      userId: new Types.ObjectId(),
      sourceObjectKey: `source-${id}`,
      clips,
      transcript: [{ startTime: 0, endTime: count * 10, text: 'caption' }],
      highlights: [],
      status: JobStatus.CUTTING_CLIPS,
      stylePreset: 'default',
    } as unknown as Job);
    return clips;
  };
  const queueJob = (jobId: string, clip: Clip) =>
    ({
      name: RENDER_CLIP,
      data: { jobId, clipId: clip._id.toString() },
      timestamp: Date.now(),
      attemptsMade: 0,
      opts: { attempts: 3 },
      progress: 0,
      updateProgress: jest.fn(() => Promise.resolve()),
      getState: jest.fn(() => Promise.resolve('failed' as const)),
    }) as unknown as BullJob<{ jobId: string; clipId: string }>;
  beforeEach(async () => {
    parents.clear();
    jest.clearAllMocks();
    directory = await mkdtemp(join(tmpdir(), 'blynta-render-test-'));
    const config = new ConfigService({ STORAGE_ROOT: directory });
    sources = new RenderSourceService(config, r2 as unknown as R2Service);
    processor = new RenderProcessor(
      jobs as unknown as JobsService,
      completion as unknown as JobsCompletionService,
      config,
      cutting as unknown as ClipCuttingService,
      captions as unknown as CaptionBurningService,
      r2 as unknown as R2Service,
      sources,
      {
        startWorker: jest.fn(() => Promise.resolve()),
      } as unknown as RenderCapacityService,
    );
  });
  afterEach(async () => {
    await sources.onModuleDestroy();
    await rm(directory, { recursive: true, force: true });
  });
  it('renders clips from two videos independently without replacing sibling outputs', async () => {
    const a = create('a', 2),
      b = create('b');
    const a1 = queueJob('a', a[0]),
      b1 = queueJob('b', b[0]);
    await Promise.all([processor.process(a1), processor.process(b1)]);
    expect(a[0]).toMatchObject({
      status: JobStatus.COMPLETED,
      hasCaptions: true,
    });
    for (const value of Object.values(a[0].renderTiming!))
      expect(Number.isFinite(value)).toBe(true);
    expect(a[1].status).toBe(JobStatus.PENDING);
    expect(parents.get('a')!.status).toBe(JobStatus.CUTTING_CLIPS);
    expect(parents.get('b')!.status).toBe(JobStatus.COMPLETED);
    expect(r2.uploadFile).toHaveBeenCalledTimes(2);
    const statuses = (
      a1.updateProgress as jest.MockedFunction<typeof a1.updateProgress>
    ).mock.calls.map(([p]) => (p as ClipRenderProgress).status);
    expect(statuses).toEqual([
      'queued',
      'cutting',
      'captioning',
      'uploading',
      'ready',
    ]);
    const captionSample = (
      a1.updateProgress as jest.MockedFunction<typeof a1.updateProgress>
    ).mock.calls
      .map(([p]) => p as ClipRenderProgress)
      .find((p) => p.status === ClipProcessingState.CAPTIONING);
    expect(captionSample?.hasCaptions).toBe(true);
    expect(Number.isFinite(captionSample?.cuttingSeconds)).toBe(true);
    const samples = (
      a1.updateProgress as jest.MockedFunction<typeof a1.updateProgress>
    ).mock.calls.map(([p]) => p as ClipRenderProgress);
    expect(
      samples.find((p) => p.status === ClipProcessingState.CAPTIONING)
        ?.progress,
    ).toBe(30);
    expect(
      samples.find((p) => p.status === ClipProcessingState.UPLOADING)?.progress,
    ).toBe(90);
    samples.forEach((p, i) =>
      expect(p.progress).toBeGreaterThanOrEqual(samples[i - 1]?.progress ?? 0),
    );
    await processor.process(queueJob('a', a[1]));
    expect(parents.get('a')!.status).toBe(JobStatus.COMPLETED);
  });
  it('retries only a failed clip and skips durable successful output', async () => {
    const clips = create('a', 2);
    await processor.process(queueJob('a', clips[0]));
    const second = queueJob('a', clips[1]);
    cutting.cutClip.mockRejectedValueOnce(new Error('forced cut failure'));
    await expect(processor.process(second)).rejects.toThrow(
      'forced cut failure',
    );
    expect(clips[0].status).toBe(JobStatus.COMPLETED);
    expect(clips[1]).toMatchObject({
      status: JobStatus.PENDING,
      processingState: 'queued',
      errorStage: 'cutting',
    });
    await processor.process(second);
    await processor.process(queueJob('a', clips[0]));
    expect(cutting.cutClip).toHaveBeenCalledTimes(3);
    expect(r2.uploadFile).toHaveBeenCalledTimes(2);
  });
  it('replays completion publication without recutting after output was persisted', async () => {
    const [clip] = create('a');
    const job = queueJob('a', clip);
    completion.finalize.mockRejectedValueOnce(
      new Error('Redis notification outage'),
    );
    await expect(processor.process(job)).rejects.toThrow(
      'Redis notification outage',
    );
    expect(clip.status).toBe(JobStatus.COMPLETED);
    await processor.process(job);
    expect(cutting.cutClip).toHaveBeenCalledTimes(1);
    expect(r2.uploadFile).toHaveBeenCalledTimes(1);
  });
  it('recovers an uploaded object after a crash before Mongo commit without another render or upload', async () => {
    const [clip] = create('a');
    r2.fileExists.mockResolvedValueOnce(true);
    await processor.process(queueJob('a', clip));
    expect(clip).toMatchObject({
      status: JobStatus.COMPLETED,
      r2ObjectKey: `clips/a/${clip._id.toString()}-captioned.mp4`,
    });
    expect(cutting.cutClip).not.toHaveBeenCalled();
    expect(r2.uploadFile).not.toHaveBeenCalled();
    expect(parents.get('a')!.status).toBe(JobStatus.COMPLETED);
  });
  it('reports terminal worker failure and preserves successes', async () => {
    const clips = create('a', 2);
    await processor.process(queueJob('a', clips[0]));
    await processor.onFailed(
      queueJob('a', clips[1]),
      new Error('stalled worker exhausted'),
    );
    expect(clips[1]).toMatchObject({
      status: JobStatus.FAILED,
      processingState: 'failed',
    });
    expect(clips[0].status).toBe(JobStatus.COMPLETED);
    expect(parents.get('a')!.status).toBe(JobStatus.FAILED);
  });
  it('sets bounded worker concurrency from configuration before consuming jobs', () => {
    const fakeWorker = {
      concurrency: 0,
      on: jest.fn(),
      run: jest.fn(() => Promise.resolve()),
    };
    Object.assign(processor, {
      _worker: fakeWorker,
      config: new ConfigService({ RENDER_CONCURRENCY: '2' }),
    });
    processor.onApplicationBootstrap();
    expect(fakeWorker.concurrency).toBe(2);
    expect(fakeWorker.run).toHaveBeenCalledTimes(1);
  });
});
