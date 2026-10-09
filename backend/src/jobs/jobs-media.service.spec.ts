import { Model } from 'mongoose';
import { Queue, JobsOptions, JobState } from 'bullmq';
import { JobDocument, Clip } from './schemas/job.schema';
import { UsersService } from '../users/users.service';
import { R2Service } from '../storage/r2.service';
import { ActivitiesService } from '../activities/activities.service';
import { Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { JobsService } from './jobs.service';
import { RenderEtaService } from './render-eta.service';
import { JobStatus, ClipProcessingState } from './schemas/job.schema';
import { renderJobId } from './jobs.constants';

describe('durable render fan-out and parent completion', () => {
  const jobId = new Types.ObjectId().toString();
  const clip = (): Clip =>
    ({
      _id: new Types.ObjectId(),
      startTime: 0,
      endTime: 10,
      status: JobStatus.PENDING,
      processingState: ClipProcessingState.QUEUED,
    }) as Clip;
  let parent: Pick<
    JobDocument,
    | '_id'
    | 'sourceObjectKey'
    | 'status'
    | 'renderManifestReady'
    | 'renderRetryRequested'
    | 'clips'
  >;
  let service: JobsService;
  const model = {
    findById: jest.fn(() => ({ exec: () => Promise.resolve(parent) })),
    updateOne: jest.fn(
      (_filter: Record<string, unknown>, _update: Record<string, unknown>) => ({
        exec: () => {
          void _filter;
          void _update;
          return Promise.resolve({ modifiedCount: 1 });
        },
      }),
    ),
    findOneAndUpdate: jest.fn(
      (
        _filter: Record<string, unknown>,
        _update: { $set: Record<string, unknown> },
        _options: Record<string, unknown>,
      ) => ({
        exec: () => {
          void _filter;
          void _update;
          void _options;
          return Promise.resolve(parent);
        },
      }),
    ),
  };
  interface Queued {
    progress?: unknown;
    name?: string;
    data?: { jobId: string; clipId: string };
    opts?: JobsOptions;
    getState: () => Promise<JobState>;
    retry?: jest.Mock<Promise<void>, [string, { resetAttemptsMade: boolean }]>;
  }
  const queued = new Map<string, Queued>();
  const queue = {
    getJob: jest.fn((id: string) => Promise.resolve(queued.get(id))),
    add: jest.fn(
      (
        name: string,
        data: { jobId: string; clipId: string },
        opts: JobsOptions,
      ) => {
        if (!parent.renderManifestReady)
          throw new Error('manifest not persisted');
        queued.set(opts.jobId!, {
          name,
          data,
          opts,
          getState: () => Promise.resolve('waiting' as const),
        });
        return Promise.resolve();
      },
    ),
  };
  beforeEach(() => {
    jest.clearAllMocks();
    queued.clear();
    parent = {
      _id: new Types.ObjectId(jobId),
      sourceObjectKey: 'durable-source',
      status: JobStatus.CUTTING_CLIPS,
      renderManifestReady: true,
      clips: Array.from({ length: 6 }, clip),
    };
    service = new JobsService(
      model as unknown as Model<JobDocument>,
      {} as Queue,
      queue as unknown as Queue,
      {} as UsersService,
      new ConfigService(),
      {} as R2Service,
      {} as ActivitiesService,
      {
        estimate: jest.fn(() => Promise.resolve(0)),
      } as unknown as RenderEtaService,
    );
  });
  it('creates six small independent render jobs and duplicate fan-out adds none', async () => {
    await service.enqueueRenders(jobId);
    await service.enqueueRenders(jobId);
    expect(queue.add).toHaveBeenCalledTimes(6);
    expect(queued.size).toBe(6);
    const items = [...queued.values()];
    expect(items.map((item) => item.opts!.priority)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(items[0].data).toEqual({
      jobId,
      clipId: parent.clips[0]._id.toString(),
    });
    expect(items[0].opts).toMatchObject({
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: false,
    });
  });
  it('repairs missing fan-out and leaves completed clips alone', async () => {
    parent.clips[0].status = JobStatus.COMPLETED;
    await service.enqueueRenders(jobId);
    expect(queue.add).toHaveBeenCalledTimes(5);
    queued.delete(renderJobId(jobId, parent.clips[1]._id.toString()));
    await service.enqueueRenders(jobId);
    expect(queue.add).toHaveBeenCalledTimes(6);
  });
  it('waits for all children and explicitly fails partial output', async () => {
    parent.clips[0].status = JobStatus.COMPLETED;
    await service.finalizeRenderState(jobId);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    parent.clips.forEach((c: Clip) => (c.status = JobStatus.COMPLETED));
    parent.clips[5].status = JobStatus.FAILED;
    await service.finalizeRenderState(jobId);
    expect(model.findOneAndUpdate.mock.calls[0][1].$set).toMatchObject({
      status: JobStatus.FAILED,
      errorStage: 'rendering',
    });
    expect(model.findOneAndUpdate.mock.calls[0][0]).toHaveProperty(
      'clips.$not.$elemMatch',
    );
  });
  it('updates one embedded clip without overwriting the shared clips array', async () => {
    const id = parent.clips[1]._id.toString();
    await service.updateClip(jobId, id, {
      status: JobStatus.COMPLETED,
      r2ObjectKey: 'output',
    });
    expect(model.updateOne).toHaveBeenCalledWith(
      {
        _id: jobId,
        'clips._id': new Types.ObjectId(id),
        deletionRequested: { $ne: true },
      },
      {
        $set: {
          'clips.$.status': JobStatus.COMPLETED,
          'clips.$.r2ObjectKey': 'output',
        },
      },
    );
  });
  it('retries the failed child job without enqueueing another pipeline', async () => {
    const retry = jest.fn<
      Promise<void>,
      [string, { resetAttemptsMade: boolean }]
    >(() => Promise.resolve());
    const c = parent.clips[1];
    parent.clips.forEach((clip: Clip) => (clip.status = JobStatus.COMPLETED));
    c.status = JobStatus.PENDING;
    parent.renderRetryRequested = true;
    queued.set(renderJobId(jobId, c._id.toString()), {
      getState: () => Promise.resolve('failed' as const),
      retry,
    });
    await service.enqueueRenders(jobId);
    expect(retry).toHaveBeenCalledWith('failed', { resetAttemptsMade: true });
    expect(queue.add).not.toHaveBeenCalled();
  });
  it('serves terminal job progress without requiring Redis history', async () => {
    parent.clips.forEach((c) => (c.status = JobStatus.COMPLETED));
    const snapshot = await service.getRenderSnapshot(parent as JobDocument);
    expect(snapshot).toMatchObject({
      ready: 6,
      total: 6,
      progressPercent: 100,
    });
    expect(queue.getJob).not.toHaveBeenCalled();
  });
  it('hands existing BullMQ state to the ETA estimator without changing clip progress', async () => {
    const eta = (service as unknown as { renderEta: RenderEtaService })
      .renderEta;
    const estimate = jest.spyOn(eta, 'estimate').mockResolvedValue(444);
    const active = parent.clips[0];
    parent.clips.forEach((clip, index) =>
      queued.set(renderJobId(jobId, clip._id.toString()), {
        getState: () => Promise.resolve(index === 0 ? 'active' : 'prioritized'),
        progress:
          index === 0
            ? {
                clipId: active._id.toString(),
                status: ClipProcessingState.CAPTIONING,
                progress: 54,
                stageProgress: 40,
                renderProgress: 54,
                processedSeconds: 4,
                durationSeconds: 10,
                etaSeconds: 60,
                cuttingSeconds: 5,
                updatedAt: Date.now(),
              }
            : 0,
      }),
    );
    const snapshot = await service.getRenderSnapshot(parent as JobDocument);
    expect(snapshot.estimatedRemainingSeconds).toBe(444);
    expect(snapshot.clips[0]).toMatchObject({
      progress: 54,
      stageProgress: 40,
      etaSeconds: 60,
    });
    expect(estimate).toHaveBeenCalledWith(
      jobId,
      JobStatus.CUTTING_CLIPS,
      expect.any(Array),
    );
    expect(estimate.mock.calls[0][2][0]).toMatchObject({
      queueState: 'active',
      progress: { etaSeconds: 60 },
    });
    expect(estimate.mock.calls[0][2][1]).toMatchObject({
      queueState: 'prioritized',
      progress: { status: 'queued' },
    });
  });
  it('prevents stale reconciliation from overwriting a ready clip', async () => {
    const id = parent.clips[0]._id.toString();
    await service.failUnfinishedClip(jobId, id, 'worker died', 'worker');
    expect(model.updateOne.mock.calls[0][0]).toMatchObject({
      clips: {
        $elemMatch: {
          _id: new Types.ObjectId(id),
          status: { $ne: JobStatus.COMPLETED },
        },
      },
    });
  });
  it('preserves overall progress while a child waits for retry and drops stage observations', async () => {
    const clip = parent.clips[0];
    queued.set(renderJobId(jobId, clip._id.toString()), {
      getState: () => Promise.resolve('delayed'),
      progress: {
        clipId: clip._id.toString(),
        status: ClipProcessingState.CAPTIONING,
        progress: 78,
        stageProgress: 80,
        renderProgress: 78,
        processedSeconds: 8,
        etaSeconds: 5,
        updatedAt: Date.now(),
      },
    });
    const snapshot = await service.getRenderSnapshot(parent as JobDocument);
    expect(snapshot.clips[0]).toMatchObject({
      status: 'queued',
      progress: 78,
      renderProgress: 78,
      stageProgress: 0,
    });
    expect(snapshot.clips[0].etaSeconds).toBeUndefined();
    expect(snapshot.clips[0].processedSeconds).toBeUndefined();
  });
});

test.each([
  [6, 45],
  [6, 60],
  [9, 45],
  [9, 60],
])(
  'persists and dispatches %s authorized %s-second clips idempotently',
  async (limit, clipSeconds) => {
    const jobId = new Types.ObjectId().toString();
    const parent: any = {
      _id: new Types.ObjectId(jobId),
      clips: [],
      clipTargetMax: limit,
      creditOperationId: 'op',
      creditOutputSeconds: limit * 60,
      videoDuration: 3000,
      sourceObjectKey: 'source',
      status: JobStatus.DETECTING_HIGHLIGHTS,
      renderManifestReady: false,
    };
    const queued = new Map<string, any>();
    const model: any = {
      updateOne: jest.fn((_filter, update) => ({
        exec: async () => {
          Object.assign(parent, update.$set);
          return { modifiedCount: 1 };
        },
      })),
    };
    const queue: any = {
      getJob: async (id) => queued.get(id),
      add: jest.fn(async (_name, _data, options) => {
        queued.set(options.jobId, { getState: async () => 'waiting' });
      }),
    };
    const service = Object.create(JobsService.prototype) as any;
    Object.assign(service, {
      jobModel: model,
      renderQueue: queue,
      configService: new ConfigService(),
      logger: { log: jest.fn() },
      findJob: async () => parent,
      dispatchMediaJobs: async (_id, work) => work(),
    });
    const highlights = Array.from({ length: 12 }, (_, i) => ({
      startTime: i * 80,
      endTime: i * 80 + clipSeconds,
      reason: 'Moment',
      score: 0.9,
      clipTitle: 'Moment',
      clipDescription: 'Moment',
      style: 'curiosity-hook',
    }));
    await service.prepareRenderManifest(jobId, highlights);
    expect(parent.clips).toHaveLength(limit);
    const ids = parent.clips.map((c) => String(c._id));
    await service.prepareRenderManifest(jobId, highlights);
    expect(parent.clips.map((c) => String(c._id))).toEqual(ids);
    await service.enqueueRenders(jobId);
    await service.enqueueRenders(jobId);
    expect(queue.add).toHaveBeenCalledTimes(limit);
    expect(parent.generationSummary.shortfall).toBe(0);
  },
);
