import { ConflictException, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { EditPlansService } from './edit-plans.service';
import { EditPlanValidatorService } from './edit-plan-validator.service';
import { EditPlanSchema } from './edit.schemas';
import { R2Service } from '../storage/r2.service';
import type { StudioAsset } from '../studio/studio.schemas';
import { JobStatus } from '../jobs/schemas/job.schema';
const jobId = '111111111111111111111111',
  clipId = '222222222222222222222222',
  planId = '333333333333333333333333';
function query<T>(value: T) {
  return {
    sort: jest.fn().mockReturnThis(),
    then: (resolve: (v: T) => unknown) => Promise.resolve(value).then(resolve),
  };
}
function setup() {
  const job = {
    clips: [
      { _id: clipId, status: JobStatus.COMPLETED, startTime: 1, endTime: 4 },
    ],
    deletionRequested: false,
  };
  const plans = {
    findOne: jest.fn(() => query<unknown>(null)),
    create: jest.fn((data: object) =>
      Promise.resolve({ _id: planId, ...data }),
    ),
  };
  const versions = { findOne: jest.fn().mockResolvedValue(null) };
  const jobs = {
    findOne: jest.fn().mockResolvedValue(job),
    exists: jest.fn().mockResolvedValue(true),
  };
  const r2 = {
    fileExists: jest.fn().mockResolvedValue(true),
    objectInfo: jest.fn().mockResolvedValue({ etag: 'source-etag' }),
    getSignedDownloadUrl: jest
      .fn()
      .mockResolvedValue('https://synthetic.invalid/signed'),
  };
  const validator = new EditPlanValidatorService(
    {} as Model<StudioAsset>,
    r2 as unknown as R2Service,
  );
  const queue = { add: jest.fn() };
  const service = new EditPlansService(
    ...([
      plans,
      versions,
      jobs,
      queue,
      validator,
      r2,
      {},
    ] as unknown as ConstructorParameters<typeof EditPlansService>),
  );
  return { service, plans, versions, jobs, job, r2, queue };
}
describe('main app AI Studio integration', () => {
  it('creates an original-engine validated default plan without enqueueing a render', async () => {
    const s = setup();
    const result = await s.service.initialize('owner', { jobId, clipId });
    expect(result.revision).toBe(1);
    expect(result.outputDuration).toBe(3);
    expect(result.sourceJobId).toBe(jobId);
    expect(s.plans.create).toHaveBeenCalledWith(
      expect.objectContaining({
        studioInitialization: true,
        sourceMedia: expect.objectContaining({
          etag: 'source-etag',
        }) as unknown,
      }),
    );
    expect(s.queue.add).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('storageKey');
  });
  it('uses an existing plan and does not create again', async () => {
    const s = setup();
    s.plans.findOne.mockReturnValue(
      query({ _id: planId, revision: 2, plan: {} }),
    );
    const result = await s.service.initialize('owner', { jobId, clipId });
    expect(result.revision).toBe(2);
    expect(s.plans.create).not.toHaveBeenCalled();
  });
  it('checks owned ready sources before retrieving or creating a plan', async () => {
    const s = setup();
    s.jobs.findOne.mockResolvedValue(null);
    await expect(
      s.service.initialize('stranger', { jobId, clipId }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(s.plans.create).not.toHaveBeenCalled();
  });
  it('rejects unfinished clips', async () => {
    const s = setup();
    s.job.clips[0].status = JobStatus.PENDING;
    await expect(
      s.service.initialize('owner', { jobId, clipId }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('enforces a unique canonical initialization without constraining manual plan creation', () => {
    expect(EditPlanSchema.indexes()).toContainEqual([
      { userId: 1, sourceClipId: 1, studioInitialization: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: { studioInitialization: true },
      }),
    ]);
  });
  it('signs completed output as a download while keeping keys server-side', async () => {
    const s = setup();
    s.versions.findOne.mockResolvedValue({
      status: 'completed',
      outputKey: 'private/output',
      revision: 2,
      sourceMedia: { jobId },
      sourceClipId: clipId,
    });
    expect(await s.service.downloadVersion('owner', planId)).toEqual({
      signedUrl: 'https://synthetic.invalid/signed',
    });
    expect(s.r2.getSignedDownloadUrl).toHaveBeenCalledWith(
      'private/output',
      3600,
      'blynta-edit-r2.mp4',
    );
    s.jobs.exists.mockResolvedValue(false);
    await expect(
      s.service.downloadVersion('owner', planId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
