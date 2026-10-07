import { Model } from 'mongoose';
import { Queue, JobsOptions, JobState } from 'bullmq';
import { JobDocument, Clip } from './schemas/job.schema';
import { UsersService } from '../users/users.service';
import { R2Service } from '../storage/r2.service';
import { ActivitiesService } from '../activities/activities.service';
import { Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { JobsService } from './jobs.service';
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
      { _id: jobId, 'clips._id': new Types.ObjectId(id) },
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
});
