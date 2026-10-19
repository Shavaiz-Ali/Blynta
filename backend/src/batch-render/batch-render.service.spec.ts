/* Mock database/storage boundaries intentionally use partial objects. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { SubmitJobCommand } from '@aws-sdk/client-batch';
import { BatchRenderService } from './batch-render.service';
import { mediaExecution } from '../jobs/cancellation-context';
import { assertBatchStorage, renderMode } from './render-task';

describe('AWS Batch durable execution', () => {
  let service: BatchRenderService;
  let records: Map<string, any>;
  let send: jest.SpyInstance;
  let r2: any;
  const identity = 'clip/parent/clip/0';
  const id = createHash('sha256').update(identity).digest('hex');
  const prefix = `job-sources/batch/${id}`;
  const prepare = jest.fn(
    async () =>
      ({
        version: 1,
        kind: 'clip',
        outputKey: `${prefix}/output.mp4`,
        deadline: Date.now() + 60000,
      }) as any,
  );
  const tick = jest.fn(async () => {});
  beforeEach(() => {
    jest.clearAllMocks();
    records = new Map();
    const model = {
      findById: (key: string) => ({
        lean: async () => (records.get(key) ? { ...records.get(key) } : null),
      }),
      create: jest.fn(async (record) => {
        if (records.has(record._id))
          throw Object.assign(new Error(), { code: 11000 });
        records.set(record._id, { ...record });
        return { toObject: () => ({ ...record }) };
      }),
      updateOne: jest.fn(async (filter, update) => {
        const record = records.get(filter._id);
        if (!record || (filter.state && filter.state !== record.state))
          return { modifiedCount: 0 };
        Object.assign(record, update.$set);
        return { modifiedCount: 1 };
      }),
      find: () => ({
        sort: () => ({
          limit: () => ({ lean: async () => [...records.values()] }),
        }),
      }),
    };
    r2 = {
      uploadBuffer: jest.fn(async () => {}),
      fileExists: jest.fn(async () => false),
      objectInfo: jest.fn(async () => ({ size: 123 })),
      downloadToBuffer: jest.fn(async () =>
        Buffer.from(
          JSON.stringify({
            jobId: 'aws-1',
            outputKey: `${prefix}/output.mp4`,
            bytes: 123,
          }),
        ),
      ),
    };
    service = new BatchRenderService(
      new ConfigService({
        RENDER_EXECUTION_MODE: 'aws_batch',
        BATCH_POLL_INTERVAL_MS: 100,
        R2_BUCKET_NAME: 'output',
        R2_SOURCE_BUCKET_NAME: 'private',
        R2_ENDPOINT: 'https://r2.invalid',
      }),
      r2,
      model as any,
    );
    send = jest
      .spyOn((service as any).client, 'send')
      .mockResolvedValue({ jobId: 'aws-1' });
    jest
      .spyOn(service, 'status')
      .mockResolvedValue({ jobId: 'aws-1', status: 'SUCCEEDED' } as any);
  });
  afterEach(() => (service as any).client.destroy());
  it('defaults to local and rejects misspelled modes', () => {
    expect(renderMode()).toBe('local');
    expect(() => renderMode('batch')).toThrow();
    expect(
      new BatchRenderService(new ConfigService(), r2, {} as any).enabled,
    ).toBe(false);
  });
  it('rejects missing or shared private storage before submission', () => {
    expect(() => assertBatchStorage(new ConfigService())).toThrow(
      'separate private',
    );
    expect(() =>
      assertBatchStorage(
        new ConfigService({
          R2_SOURCE_BUCKET_NAME: 'same',
          R2_BUCKET_NAME: 'same',
          R2_ENDPOINT: 'https://r2.invalid',
        }),
      ),
    ).toThrow('separate private');
    expect(send).not.toHaveBeenCalled();
  });
  it('submits once for concurrent callers and persists the AWS ID', async () => {
    const results = await Promise.all([
      service.execute(identity, prepare, tick),
      service.execute(identity, prepare, tick),
    ]);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBeInstanceOf(SubmitJobCommand);
    expect(send.mock.calls[0][0].input).toMatchObject({
      jobQueue: 'blynta-render-queue',
      retryStrategy: { attempts: 2 },
      timeout: { attemptDurationSeconds: 3600 },
      containerOverrides: {
        resourceRequirements: [
          { type: 'VCPU', value: '2' },
          { type: 'MEMORY', value: '4096' },
        ],
      },
    });
    expect(records.get(id)).toMatchObject({
      jobId: 'aws-1',
      state: 'SUCCEEDED',
    });
    expect(results[0]).toEqual(results[1]);
  });
  it('reattaches after a backend restart without preparing or submitting again', async () => {
    records.set(id, {
      _id: id,
      prefix,
      jobId: 'aws-1',
      state: 'SUBMITTED',
      deadline: new Date(Date.now() + 60000),
    });
    await service.execute(identity, prepare, tick);
    expect(send).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });
  it('fails closed after an ambiguous submission and never resubmits', async () => {
    send.mockRejectedValueOnce(new Error('connection lost'));
    await expect(service.execute(identity, prepare, tick)).rejects.toThrow(
      'connection lost',
    );
    expect(records.get(id).state).toBe('UNKNOWN');
    await expect(service.execute(identity, prepare, tick)).rejects.toThrow(
      'Ambiguous',
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('ignores output markers from a FAILED Batch task', async () => {
    jest.mocked(service.status).mockResolvedValue({ status: 'FAILED' } as any);
    await expect(service.execute(identity, prepare, tick)).rejects.toThrow(
      'task failed',
    );
    expect(r2.downloadToBuffer).not.toHaveBeenCalled();
    expect(records.get(id).state).toBe('FAILED');
  });
  it.each([
    { jobId: 'wrong', outputKey: `${prefix}/output.mp4`, bytes: 123 },
    { jobId: 'aws-1', outputKey: 'clips/other.mp4', bytes: 123 },
    { jobId: 'aws-1', outputKey: `${prefix}/output.mp4`, bytes: 999 },
  ])('rejects mismatched output identity or size: %j', async (result) => {
    r2.downloadToBuffer.mockResolvedValue(Buffer.from(JSON.stringify(result)));
    await expect(service.execute(identity, prepare, tick)).rejects.toThrow(
      /Invalid Batch result|verification failed/,
    );
    expect(records.get(id).state).not.toBe('SUCCEEDED');
  });
  it('waits through RUNNING and forwards bounded progress', async () => {
    jest
      .mocked(service.status)
      .mockResolvedValueOnce({ status: 'RUNNING' } as any);
    r2.fileExists.mockResolvedValue(true);
    r2.downloadToBuffer.mockResolvedValueOnce(
      Buffer.from(
        JSON.stringify({ jobId: 'aws-1', phase: 'cutting', percent: 120 }),
      ),
    );
    await service.execute(identity, prepare, tick);
    expect(tick).toHaveBeenCalledWith('cutting', 99);
  });
  it('cancels and terminates queued/running tasks on cancellation', async () => {
    const abort = new AbortController();
    jest.mocked(service.status).mockImplementationOnce(async () => {
      abort.abort();
      return { status: 'RUNNING' } as any;
    });
    await expect(
      mediaExecution.run({ signal: abort.signal, children: new Set() }, () =>
        service.execute(identity, prepare, tick),
      ),
    ).rejects.toThrow('cancelled');
    expect(send.mock.calls.map(([c]) => c.constructor.name)).toEqual([
      'SubmitJobCommand',
      'CancelJobCommand',
      'TerminateJobCommand',
    ]);
    expect(records.get(id).state).toBe('CANCELLED');
  });
  it('reconciles deadlines even without an active Bull worker', async () => {
    records.set(id, {
      _id: id,
      prefix,
      jobId: 'aws-1',
      state: 'SUBMITTED',
      deadline: new Date(0),
    });
    await service.reconcile();
    expect(send).toHaveBeenCalledTimes(2);
    expect(records.get(id).state).toBe('CANCELLED');
  });
  it('reconciles parent cancellation after its Bull worker disappears', async () => {
    records.set(id, {
      _id: id,
      prefix,
      jobId: 'aws-1',
      state: 'SUBMITTED',
      owner: { jobId: '507f1f77bcf86cd799439011' },
      deadline: new Date(Date.now() + 60000),
    });
    Object.assign(service, {
      connection: {
        collection: () => ({
          findOne: async () => ({ cancellationRequestedAt: new Date() }),
        }),
      },
    });
    await service.reconcile();
    expect(send).toHaveBeenCalledTimes(2);
    expect(records.get(id).state).toBe('CANCELLED');
  });
});
