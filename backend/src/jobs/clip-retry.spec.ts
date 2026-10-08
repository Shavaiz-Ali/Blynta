import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { Queue } from 'bullmq';
import { JobsService } from './jobs.service';
import {
  Clip,
  ClipProcessingState,
  JobDocument,
  JobStatus,
} from './schemas/job.schema';
import { UsersService } from '../users/users.service';
import { R2Service } from '../storage/r2.service';
import { ActivitiesService } from '../activities/activities.service';
import { RenderEtaService } from './render-eta.service';
import { renderJobId } from './jobs.constants';
import { clipFailure } from './clip-failure';

describe('individual clip retry recovery', () => {
  let parent: JobDocument;
  let service: JobsService;
  const source = { fileExists: jest.fn() };
  const child = { getState: jest.fn(), retry: jest.fn(), progress: {} };
  const queue = { getJob: jest.fn(), add: jest.fn() };
  const model = {
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  };
  const pipeline = { add: jest.fn(), getJob: jest.fn() };
  beforeEach(() => {
    jest.resetAllMocks();
    parent = {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      sourceObjectKey: 'source',
      status: JobStatus.CUTTING_CLIPS,
      renderManifestReady: true,
      transcript: [],
      clips: [
        JobStatus.COMPLETED,
        JobStatus.FAILED,
        JobStatus.CUTTING_CLIPS,
        JobStatus.FAILED,
      ].map((status, index) => ({
        _id: new Types.ObjectId(),
        status,
        startTime: index * 10,
        endTime: index * 10 + 10,
        retryCount: 0,
        processingState:
          status === JobStatus.FAILED
            ? ClipProcessingState.FAILED
            : ClipProcessingState.CUTTING,
      })),
    } as unknown as JobDocument;
    model.findById.mockImplementation(() => ({
      exec: async () => ({
        ...parent,
        clips: parent.clips.map((c) => ({ ...c })),
      }),
    }));
    model.findOneAndUpdate.mockImplementation((filter, updates) => ({
      session() {
        return this;
      },
      exec: async () => {
        const clip = parent.clips.find((c) =>
          c._id.equals(filter.clips.$elemMatch._id),
        );
        if (!clip || clip.status !== filter.clips.$elemMatch.status)
          return null;
        clip.status = JobStatus.PENDING;
        clip.processingState = ClipProcessingState.QUEUED;
        clip.retryRequested = true;
        clip.retryQueuedAt = updates.$set['clips.$.retryQueuedAt'];
        clip.retryCount = (clip.retryCount ?? 0) + 1;
        parent.status = JobStatus.CUTTING_CLIPS;
        return parent;
      },
    }));
    model.updateOne.mockImplementation((filter, updates) => ({
      exec: async () => {
        if (updates.$set?.['clips.$.retryRequested'] === false) {
          const clip = parent.clips.find((c) =>
            c._id.equals(filter.clips.$elemMatch._id),
          );
          if (clip && clip.retryCount === filter.clips.$elemMatch.retryCount)
            clip.retryRequested = false;
        }
        return { modifiedCount: 1 };
      },
    }));
    child.getState.mockResolvedValue('failed');
    child.retry.mockImplementation(async () => {
      child.getState.mockResolvedValue('waiting');
    });
    queue.getJob.mockResolvedValue(child);
    queue.add.mockResolvedValue({});
    source.fileExists.mockResolvedValue(true);
    service = new JobsService(
      model as unknown as Model<JobDocument>,
      pipeline as unknown as Queue,
      queue as unknown as Queue,
      {} as UsersService,
      new ConfigService(),
      source as unknown as R2Service,
      {} as ActivitiesService,
      { estimate: async () => null } as unknown as RenderEtaService,
    );
  });
  const retry = () =>
    service.retryClip(
      parent.userId.toString(),
      parent._id.toString(),
      parent.clips[1]._id.toString(),
    );

  it('retries only the selected failed child while another child is active', async () => {
    const others = [0, 2, 3].map((i) => ({ ...parent.clips[i] }));
    await expect(retry()).resolves.toMatchObject({ status: 'queued' });
    expect(child.retry).toHaveBeenCalledWith('failed', {
      resetAttemptsMade: true,
    });
    expect(parent.clips[1]).toMatchObject({
      status: JobStatus.PENDING,
      retryRequested: false,
      retryCount: 1,
    });
    expect([0, 2, 3].map((i) => parent.clips[i])).toEqual(others);
    expect(pipeline.add).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(
      model.findOneAndUpdate.mock.calls[0][0].clips.$elemMatch.status,
    ).toBe(JobStatus.FAILED);
  });
  it('claims concurrent requests once', async () => {
    const results = await Promise.allSettled([retry(), retry(), retry()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(child.retry).toHaveBeenCalledTimes(1);
    expect(parent.clips[1].retryCount).toBe(1);
  });
  it('leaves durable retry intent for reconciliation when Redis is unavailable', async () => {
    child.retry.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(retry()).rejects.toThrow('Retry is saved');
    expect(parent.clips[1].retryRequested).toBe(true);
    // Simulate restarting after the API committed intent but could not dispatch.
    await service.enqueueRenders(parent._id.toString());
    expect(parent.clips[1].retryRequested).toBe(false);
    expect(child.retry).toHaveBeenCalledTimes(2);
    expect(queue.getJob).not.toHaveBeenCalledWith(
      renderJobId(parent._id.toString(), parent.clips[3]._id.toString()),
    );
  });
  it.each(['failed', 'completed'])(
    'recovers retained %s BullMQ jobs',
    async (state) => {
      child.getState.mockResolvedValue(state);
      await retry();
      expect(child.retry).toHaveBeenCalledWith(state, {
        resetAttemptsMade: true,
      });
    },
  );
  it('recreates an absent child with its original deterministic identity', async () => {
    queue.getJob.mockResolvedValue(undefined);
    await retry();
    expect(queue.add).toHaveBeenCalledWith(
      expect.any(String),
      {
        jobId: parent._id.toString(),
        clipId: parent.clips[1]._id.toString(),
      },
      expect.objectContaining({
        jobId: renderJobId(
          parent._id.toString(),
          parent.clips[1]._id.toString(),
        ),
      }),
    );
  });
  it.each(['active', 'waiting', 'delayed'])(
    'refuses a new retry for a %s nonfailed clip',
    async (state) => {
      parent.clips[1].status = JobStatus.PENDING;
      child.getState.mockResolvedValue(state);
      await expect(retry()).rejects.toThrow('already processing or ready');
      expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );
  it('waits for an interrupted worker to release its active lock', async () => {
    child.getState.mockResolvedValue('active');
    await expect(retry()).rejects.toThrow('previous attempt');
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects an unavailable original video before changing any clip', async () => {
    source.fileExists.mockResolvedValue(false);
    await expect(retry()).rejects.toThrow(
      'original video is no longer available',
    );
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('handles a storage outage without treating the source as deleted', async () => {
    source.fileExists.mockRejectedValue(new Error('connection unavailable'));
    await expect(retry()).rejects.toThrow('Could not check');
    expect(parent.clips[1].status).toBe(JobStatus.FAILED);
  });
  it('checks ownership before accessing the queue or source', async () => {
    await expect(
      service.retryClip(
        new Types.ObjectId().toString(),
        parent._id.toString(),
        parent.clips[1]._id.toString(),
      ),
    ).rejects.toThrow();
    expect(source.fileExists).not.toHaveBeenCalled();
    expect(queue.getJob).not.toHaveBeenCalled();
  });
  it('discards old progress, stage and ETA after an intentional retry', async () => {
    parent.clips[1].retryQueuedAt = new Date(2000);
    parent.clips[1].status = JobStatus.PENDING;
    parent.clips[1].processingState = ClipProcessingState.QUEUED;
    child.getState.mockResolvedValue('active');
    child.progress = {
      status: 'captioning',
      progress: 99,
      stageProgress: 98,
      etaSeconds: 1,
      updatedAt: 1000,
    };
    const snapshot = await service.getRenderSnapshot(parent);
    expect(snapshot.clips[1]).toMatchObject({ status: 'queued', progress: 0 });
    expect(snapshot.clips[1].etaSeconds).toBeUndefined();
    expect(snapshot).toMatchObject({ ready: 1, failed: 1, total: 4 });
  });
  it('fences stale failure writes by retry generation and pending intent', async () => {
    await service.failUnfinishedClip(
      parent._id.toString(),
      parent.clips[1]._id.toString(),
      'stalled',
      'worker',
      2,
    );
    expect(model.updateOne.mock.calls[0][0].clips.$elemMatch).toMatchObject({
      retryCount: 2,
      retryRequested: { $ne: true },
      status: { $ne: JobStatus.COMPLETED },
    });
  });
  it('matches legacy clips whose initial retry counter was not persisted', async () => {
    await service.failUnfinishedClip(
      parent._id.toString(),
      parent.clips[1]._id.toString(),
      'stalled',
      'worker',
      0,
    );
    expect(
      model.updateOne.mock.calls[0][0].clips.$elemMatch.retryCount,
    ).toEqual({ $in: [null, 0] });
  });
  it('maps internal failures to safe public explanations', () => {
    const clip = {
      errorMessage: 'ffmpeg -i /internal/private/source.mp4\nstacktrace',
      errorStage: 'captioning',
      attemptCount: 3,
    } as Clip;
    expect(clipFailure(clip, true)).toMatchObject({
      stage: 'Adding captions',
      attempt: 3,
      retryAvailable: true,
    });
    expect(JSON.stringify(clipFailure(clip, true))).not.toMatch(
      /ffmpeg|internal|stacktrace/,
    );
    expect(clipFailure(clip, false)).toMatchObject({
      retryAvailable: false,
      message: expect.stringContaining('no longer available'),
    });
    expect(clipFailure({} as Clip)).not.toHaveProperty('stage');
  });
});
