import { randomUUID } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { Job, JobsOptions, Queue } from 'bullmq';
import { ActivitiesService, CreateActivityInput } from './activities.service';
import { ActivitiesProcessor } from './activities.processor';
import { ACTIVITY_JOBS } from './activities.constants';
import {
  ActivityCategory,
  ActivityDocument,
  ActivityType,
} from './schemas/activity.schema';

describe('activity event identity across retries and competing workers', () => {
  const input: CreateActivityInput = {
    userId: new Types.ObjectId(),
    type: ActivityType.CLIP_DOWNLOAD,
    category: ActivityCategory.JOB,
    title: 'Clip download requested',
  };
  let documents: Map<string, ActivityDocument>;
  let jobs: Map<
    string,
    { id: string; name: string; data: CreateActivityInput }
  >;
  let service: ActivitiesService;
  let processor: ActivitiesProcessor;

  beforeEach(() => {
    documents = new Map();
    jobs = new Map();
    class UniqueModel {
      constructor(private readonly data: CreateActivityInput) {}
      async save() {
        await Promise.resolve();
        const key = this.data.dedupeKey!;
        if (documents.has(key))
          throw Object.assign(new Error('duplicate'), { code: 11000 });
        const doc = {
          ...this.data,
          _id: new Types.ObjectId(),
        } as ActivityDocument;
        documents.set(key, doc);
        return doc;
      }
      static findOne(filter: { dedupeKey: string }) {
        return { exec: () => Promise.resolve(documents.get(filter.dedupeKey)) };
      }
    }
    const queue = {
      add: async (
        name: string,
        data: CreateActivityInput,
        options: JobsOptions,
      ) => {
        await Promise.resolve();
        const id = options.jobId!;
        if (!jobs.has(id)) jobs.set(id, { id, name, data });
        return jobs.get(id);
      },
    };
    service = new ActivitiesService(
      UniqueModel as unknown as Model<ActivityDocument>,
      queue as unknown as Queue,
    );
    processor = new ActivitiesProcessor(service);
  });

  it('reuses one document after persistence succeeds but the attempt fails afterward', async () => {
    await service.queueCreate(input);
    const queued = [...jobs.values()][0];
    const attempt = { ...queued, attemptsMade: 0 } as Job;
    await expect(
      (async () => {
        await processor.process(attempt);
        throw new Error('lost acknowledgement after Mongo insert');
      })(),
    ).rejects.toThrow('lost acknowledgement');
    const firstId = [...documents.values()][0]._id.toString();
    await processor.process({ ...attempt, attemptsMade: 1 } as Job);
    expect(jobs.size).toBe(1);
    expect(documents.size).toBe(1);
    expect([...documents.values()][0]._id.toString()).toBe(firstId);
  });

  it('deduplicates competing producers/workers and permits a later action', async () => {
    const event = { ...input, dedupeKey: `download:${randomUUID()}` };
    await Promise.all([service.queueCreate(event), service.queueCreate(event)]);
    expect(jobs.size).toBe(1);
    const queued = { ...[...jobs.values()][0], attemptsMade: 0 } as Job;
    await Promise.all([
      processor.process(queued),
      new ActivitiesProcessor(service).process(queued),
    ]);
    expect(documents.size).toBe(1);
    await service.queueCreate({
      ...event,
      dedupeKey: `download:${randomUUID()}`,
    });
    await processor.process({
      ...[...jobs.values()][1],
      attemptsMade: 0,
    } as Job);
    expect(jobs.size).toBe(2);
    expect(documents.size).toBe(2);
  });

  it('keeps database protection after a completed queue job has been removed', async () => {
    const event = { ...input, dedupeKey: `download:${randomUUID()}` };
    await service.queueCreate(event);
    await processor.process({
      ...[...jobs.values()][0],
      attemptsMade: 0,
    } as Job);
    jobs.clear();
    await service.queueCreate(event);
    await processor.process({
      ...[...jobs.values()][0],
      attemptsMade: 0,
    } as Job);
    expect(documents.size).toBe(1);
  });

  it('assigns stable fallback keys to legacy jobs without an event key', async () => {
    const legacy = {
      id: 'old-queue-job',
      name: ACTIVITY_JOBS.CREATE,
      data: input,
      attemptsMade: 0,
    } as Job;
    await processor.process(legacy);
    await processor.process({ ...legacy, attemptsMade: 1 } as Job);
    expect(documents.size).toBe(1);
  });

  it('treats separate ordinary producer calls as separate actions', async () => {
    await service.queueCreate(input);
    await service.queueCreate(input);
    expect(jobs.size).toBe(2);
    for (const queued of jobs.values()) {
      expect(queued.id).not.toContain(':');
      expect(queued.data.dedupeKey).toBeDefined();
    }
  });
});
