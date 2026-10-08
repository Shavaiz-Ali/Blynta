import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { Queue } from 'bullmq';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JobsService } from './jobs.service';
import {
  JobDocument,
  JobStatus,
  ClipProcessingState,
} from './schemas/job.schema';
import { UsersService } from '../users/users.service';
import { R2Service } from '../storage/r2.service';
import { ActivitiesService } from '../activities/activities.service';
import { RenderEtaService } from './render-eta.service';
import {
  cancellationSignal,
  mediaExecution,
  ProcessingCancelled,
} from './cancellation-context';
import { ProcessRegistryService } from '../common/services/process-registry.service';
import { runCommandWithProgress } from '../media/utils/run-command-with-progress';
import * as hostCommands from '../media/utils/host-command';

interface TestFilter {
  cancellationRequestedAt?: null;
  deletionRequested?: { $ne: boolean };
  status?: JobStatus | { $nin: JobStatus[] };
  $or?: unknown[];
}
interface TestUpdate {
  $addToSet?: { activeExecutions: string };
  $pull?: { activeExecutions: string };
  $set?: Record<string, unknown>;
  $unset?: Record<string, unknown>;
}

describe('durable cooperative cancellation', () => {
  let parent: JobDocument;
  let jobs: JobsService;
  let storage: string;
  const queue = { getJobs: jest.fn(), getJob: jest.fn(), add: jest.fn() };
  const r2 = { deleteFile: jest.fn(), fileExists: jest.fn() };
  const activities = { queueCreate: jest.fn() };
  const model = {
    findById: jest.fn(),
    updateOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  };
  // Stateful fake checks the Mongo compare-and-set fences, rather than unconditional success.
  const matches = (filter: TestFilter): boolean => {
    if (
      filter.cancellationRequestedAt === null &&
      parent.cancellationRequestedAt
    )
      return false;
    if (filter.deletionRequested && parent.deletionRequested) return false;
    if (typeof filter.status === 'string' && parent.status !== filter.status)
      return false;
    if (
      typeof filter.status === 'object' &&
      filter.status.$nin?.includes(parent.status)
    )
      return false;
    if (filter.$or && parent.activeExecutions?.length) return false;
    return true;
  };
  const apply = (update: TestUpdate) => {
    if (update.$addToSet)
      parent.activeExecutions!.push(update.$addToSet.activeExecutions);
    if (update.$pull)
      parent.activeExecutions = parent.activeExecutions!.filter(
        (t) => t !== update.$pull?.activeExecutions,
      );
    for (const [field, value] of Object.entries(update.$set ?? {})) {
      if (field.startsWith('clips.$[unfinished].')) {
        for (const clip of parent.clips) {
          if (![JobStatus.COMPLETED, JobStatus.FAILED].includes(clip.status))
            Reflect.set(clip, field.split('.').at(-1)!, value);
        }
      } else if (field === 'clips.$[].retryRequested')
        parent.clips.forEach((c) => (c.retryRequested = false));
      else Reflect.set(parent, field, value);
    }
    for (const field of Object.keys(update.$unset ?? {}))
      Reflect.deleteProperty(parent, field);
  };
  beforeEach(async () => {
    jest.resetAllMocks();
    storage = await mkdtemp(join(tmpdir(), 'blynta-cancel-'));
    parent = {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      status: JobStatus.CUTTING_CLIPS,
      renderManifestReady: true,
      activeExecutions: [],
      transcript: [],
      highlights: [],
      sourceObjectKey: 'shared-source',
      clips: [JobStatus.COMPLETED, JobStatus.PENDING, JobStatus.FAILED].map(
        (status) => ({
          _id: new Types.ObjectId(),
          startTime: 0,
          endTime: 10,
          status,
          processingState:
            status === JobStatus.COMPLETED
              ? ClipProcessingState.READY
              : ClipProcessingState.QUEUED,
          ...(status === JobStatus.COMPLETED
            ? { r2ObjectKey: 'ready-clip' }
            : {}),
        }),
      ),
    } as unknown as JobDocument;
    model.findById.mockImplementation(() => ({
      exec: () => Promise.resolve(parent),
    }));
    model.updateOne.mockImplementation(
      (filter: TestFilter, update: TestUpdate) => ({
        exec: () =>
          Promise.resolve().then(() => {
            if (!matches(filter)) return { matchedCount: 0 };
            apply(update);
            return { matchedCount: 1 };
          }),
      }),
    );
    model.findOneAndUpdate.mockImplementation(
      (filter: TestFilter, update: TestUpdate) => ({
        exec: () =>
          Promise.resolve().then(() => {
            if (!matches(filter)) return null;
            apply(update);
            return parent;
          }),
      }),
    );
    model.findByIdAndDelete.mockReturnValue({
      exec: () => Promise.resolve(parent),
    });
    queue.getJobs.mockResolvedValue([]);
    r2.deleteFile.mockResolvedValue(undefined);
    r2.fileExists.mockResolvedValue(true);
    jobs = new JobsService(
      model as unknown as Model<JobDocument>,
      queue as unknown as Queue,
      queue as unknown as Queue,
      {} as UsersService,
      { get: () => storage } as unknown as ConfigService,
      r2 as unknown as R2Service,
      activities as unknown as ActivitiesService,
      {} as RenderEtaService,
    );
  });
  afterEach(async () => {
    await rm(storage, { recursive: true, force: true });
  });
  const cancel = () =>
    jobs.cancelJob(parent.userId.toString(), parent._id.toString());

  it('cancels queued work, preserves completed and failed clips, and records completed work below 100%', async () => {
    const pending = {
      data: { jobId: parent._id.toString() },
      getState: () => Promise.resolve('waiting'),
      remove: jest.fn(),
    };
    queue.getJobs.mockImplementation((states: string[]) =>
      Promise.resolve(states.length === 1 ? [] : [pending]),
    );
    await cancel();
    expect(parent.status).toBe(JobStatus.CANCELLED);
    expect(parent.clips.map((c) => c.status)).toEqual([
      JobStatus.COMPLETED,
      JobStatus.CANCELLED,
      JobStatus.FAILED,
    ]);
    expect(parent.progressPercent).toBe(33);
    expect(pending.remove).toHaveBeenCalled();
    expect(r2.deleteFile).not.toHaveBeenCalled();
  });
  it('is idempotent and never replaces the original request timestamp', async () => {
    await cancel();
    const requested = parent.cancellationRequestedAt;
    await cancel();
    expect(parent.cancellationRequestedAt).toBe(requested);
    expect(parent.status).toBe(JobStatus.CANCELLED);
  });
  it('does not turn a completed video into a cancellation', async () => {
    parent.status = JobStatus.COMPLETED;
    await cancel();
    expect(parent.status).toBe(JobStatus.COMPLETED);
    expect(parent.cancellationRequestedAt).toBeUndefined();
  });
  it('exposes recoverable shutdown for a completed parent whose crashed worker never acknowledged cleanup', async () => {
    parent.status = JobStatus.COMPLETED;
    parent.activeExecutions = ['lost-worker/123/after-upload'];
    await cancel();
    expect(parent.status).toBe(JobStatus.CANCELLING);
    expect(parent.clips[0].status).toBe(JobStatus.COMPLETED);
    expect(parent.activeExecutions).toHaveLength(1);
  });
  it('does not remove active Bull jobs or delete their media', async () => {
    const active = {
      data: { jobId: parent._id.toString() },
      getState: () => Promise.resolve('active'),
      remove: jest.fn(),
    };
    queue.getJobs.mockResolvedValue([active]);
    await cancel();
    expect(parent.status).toBe(JobStatus.CANCELLING);
    expect(active.remove).not.toHaveBeenCalled();
    await expect(
      jobs.deleteJob(parent.userId.toString(), parent._id.toString()),
    ).rejects.toThrow('still processing');
    expect(r2.deleteFile).not.toHaveBeenCalled();
  });
  it('keeps unreachable/crashed executions pending even after BullMQ loses their lock', async () => {
    parent.activeExecutions = ['lost-host/123/execution'];
    await cancel();
    await jobs.finalizeCancellation(parent._id.toString());
    expect(parent.status).toBe(JobStatus.CANCELLING);
    expect(parent.activeExecutions).toHaveLength(1);
    await expect(
      jobs.deleteJob(parent.userId.toString(), parent._id.toString()),
    ).rejects.toThrow();
  });
  it('a restarted worker cannot resume intentionally cancelled work', async () => {
    await cancel();
    const work = jest.fn();
    await jobs.runMediaExecution(parent._id.toString(), work);
    await jobs.enqueuePipeline(parent._id.toString());
    await jobs.enqueueRenders(parent._id.toString());
    expect(work).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
  it('waits for an in-flight retry dispatch before finalizing cancellation', async () => {
    let release!: () => void;
    queue.add.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const dispatch = jobs.enqueueRenders(parent._id.toString());
    await new Promise((resolve) => setImmediate(resolve));
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(parent.activeExecutions).toHaveLength(1);
    await cancel();
    expect(parent.status).toBe(JobStatus.CANCELLING);
    await expect(
      jobs.deleteJob(parent.userId.toString(), parent._id.toString()),
    ).rejects.toThrow();
    release();
    await dispatch;
    expect(parent.activeExecutions).toHaveLength(0);
    await jobs.finalizeCancellation(parent._id.toString());
    expect(parent.status).toBe(JobStatus.CANCELLED);
  });
  it('cannot persist a stale stage transition after cancellation won the Mongo claim', async () => {
    await cancel();
    expect(
      await jobs.updateJob(parent._id.toString(), {
        status: JobStatus.TRANSCRIBING,
      }),
    ).toBeNull();
    expect(parent.status).toBe(JobStatus.CANCELLED);
  });
  it('allows a successfully uploaded clip to commit during shutdown before final acknowledgement', async () => {
    parent.activeExecutions = ['worker/123/finishing-upload'];
    await cancel();
    await jobs.updateClip(
      parent._id.toString(),
      parent.clips[1]._id.toString(),
      {
        status: JobStatus.COMPLETED,
        processingState: ClipProcessingState.READY,
        r2ObjectKey: 'uploaded',
      },
    );
    const calls = model.updateOne.mock.calls as [TestFilter, TestUpdate][];
    const filter = calls.at(-1)![0];
    expect(filter.cancellationRequestedAt).toBeUndefined();
    expect(filter.deletionRequested).toEqual({ $ne: true });
    expect(parent.status).toBe(JobStatus.CANCELLING);
  });
  it.each([
    JobStatus.PENDING,
    JobStatus.TRANSCRIBING,
    JobStatus.DETECTING_HIGHLIGHTS,
    JobStatus.CUTTING_CLIPS,
  ])(
    'signals active work in %s and acknowledges only after cleanup',
    async (status) => {
      parent.status = status;
      const work = jobs.runMediaExecution(parent._id.toString(), async () => {
        await new Promise<void>((resolve) => {
          cancellationSignal()!.addEventListener('abort', () => resolve(), {
            once: true,
          });
        });
        expect(parent.status).toBe(JobStatus.CANCELLING);
        expect(parent.activeExecutions).toHaveLength(1);
        throw new ProcessingCancelled();
      });
      await new Promise((resolve) => setImmediate(resolve));
      await cancel();
      expect(parent.status).toBe(JobStatus.CANCELLING);
      await work;
      expect(parent.activeExecutions).toHaveLength(0);
      await jobs.finalizeCancellation(parent._id.toString());
      expect(parent.status).toBe(JobStatus.CANCELLED);
    },
  );
  it('rejects another user before persisting intent or signaling workers', async () => {
    await expect(
      jobs.cancelJob(new Types.ObjectId().toString(), parent._id.toString()),
    ).rejects.toThrow();
    expect(model.updateOne).not.toHaveBeenCalled();
  });
  it('retry claims lose a race against cancellation', async () => {
    parent.status = JobStatus.FAILED;
    model.findOneAndUpdate.mockImplementation(
      (filter: TestFilter, update: TestUpdate) => ({
        exec: () =>
          Promise.resolve().then(() => {
            parent.cancellationRequestedAt = new Date();
            parent.status = JobStatus.CANCELLING;
            expect(filter.cancellationRequestedAt).toBeNull();
            if (!matches(filter)) return null;
            apply(update);
            return parent;
          }),
      }),
    );
    await expect(
      jobs.retryJob(parent.userId.toString(), parent._id.toString()),
    ).rejects.toThrow();
    expect(queue.add).not.toHaveBeenCalled();
  });
  it('rejects clip retries on cancelling and cancelled parents, including already failed clips', async () => {
    await cancel();
    await expect(
      jobs.retryClip(
        parent.userId.toString(),
        parent._id.toString(),
        parent.clips[2]._id.toString(),
      ),
    ).rejects.toThrow('cannot be retried');
    expect(queue.add).not.toHaveBeenCalled();
  });
  it('deletes after confirmation, including interrupted upload objects, and retains shared source media', async () => {
    await cancel();
    await jobs.deleteJob(parent.userId.toString(), parent._id.toString());
    expect(r2.deleteFile).toHaveBeenCalledWith('ready-clip');
    expect(r2.deleteFile).toHaveBeenCalledWith(
      `clips/${parent._id.toString()}/${parent.clips[1]._id.toString()}-captioned.mp4`,
    );
    expect(r2.deleteFile).not.toHaveBeenCalledWith('shared-source');
    expect(model.findByIdAndDelete).toHaveBeenCalled();
  });
  it('does not delete records when storage cleanup fails, and allows a later deletion attempt', async () => {
    await cancel();
    r2.deleteFile.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(
      jobs.deleteJob(parent.userId.toString(), parent._id.toString()),
    ).rejects.toThrow('pending');
    expect(model.findByIdAndDelete).not.toHaveBeenCalled();
    await jobs.deleteJob(parent.userId.toString(), parent._id.toString());
    expect(model.findByIdAndDelete).toHaveBeenCalled();
  });
});

describe('subprocess cancellation', () => {
  it('terminates and drains a real long-running subprocess through the FFmpeg command runner', async () => {
    const controller = new AbortController();
    const context = {
      signal: controller.signal,
      children: new Set<Promise<void>>(),
    };
    const registry = new ProcessRegistryService();

    const directory = await mkdtemp(join(tmpdir(), 'blynta-child-'));
    const script = join(directory, 'child.cjs');
    await writeFile(
      script,
      'console.log("started"); setInterval(() => {}, 1000);',
    );
    // Isolate process cancellation from the platform capacity gate (tested separately).
    const host = jest
      .spyOn(hostCommands, 'hostCommand')
      .mockImplementation((command, args) => ({
        command,
        args,
      }));
    try {
      const work = mediaExecution.run(context, () =>
        runCommandWithProgress(
          process.execPath,
          [script],
          (line) => {
            if (line.includes('started')) controller.abort();
          },
          registry,
        ),
      );
      await expect(work).rejects.toThrow('Processing cancelled');
      await Promise.all([...context.children]);
      expect(controller.signal.aborted).toBe(true);
      expect(context.children.size).toBe(0);
    } finally {
      controller.abort();
      host.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  }, 15000);
});
