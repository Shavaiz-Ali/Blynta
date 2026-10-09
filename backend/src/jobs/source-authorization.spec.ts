import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobStatus } from './schemas/job.schema';
import { SourceAuthorizationError } from '../billing/source-authorization';
import { INITIAL_PRICING, clipPrice } from '../billing/credit-pricing';
import { jobFailure } from './job-failure';
import { PreflightJobDto } from './dto/create-job.dto';

describe('source authorization recovery', () => {
  it('only accepts a valid review job ID and rejects client-supplied measured durations', () => {
    const base = {
      sourceUrl: 'https://youtu.be/B6NVvtIz9_Q',
      reviewJobId: '6ac8c8e15feea2543bffc322',
    };
    expect(PreflightJobDto.schema.safeParse(base).success).toBe(true);
    expect(
      PreflightJobDto.schema.safeParse({ ...base, measuredSourceSeconds: 1 })
        .success,
    ).toBe(false);
    expect(
      PreflightJobDto.schema.safeParse({ ...base, reviewJobId: 'invalid' })
        .success,
    ).toBe(false);
  });
  const sourceUrl = 'https://youtu.be/B6NVvtIz9_Q';
  const failed = {
    status: JobStatus.FAILED,
    sourceUrl,
    errorMessage: new SourceAuthorizationError(300, 300.461).message,
    measuredSourceSeconds: 300.461,
  };
  it.each([
    failed.errorMessage,
    'Source exceeds approved duration. Increase your budget and submit again.',
  ])(
    'blocks manual retry before reserving or enqueueing: %s',
    async (errorMessage) => {
      const claim = jest.fn();
      const service = Object.create(JobsService.prototype) as JobsService;
      Object.assign(service, {
        getJobById: jest.fn().mockResolvedValue(failed),
        jobModel: {
          findById: () => ({
            exec: () => Promise.resolve({ ...failed, errorMessage }),
          }),
          findOneAndUpdate: claim,
        },
      });
      await expect(service.retryJob('user', 'job')).rejects.toMatchObject({
        response: { code: 'SOURCE_DURATION_AUTHORIZATION_REQUIRED' },
      });
      expect(claim).not.toHaveBeenCalled();
      expect(jobFailure({ errorMessage, errorStage: 'pending' })).toMatchObject(
        { retryAvailable: false, requiresApproval: true },
      );
    },
  );
  it('retains ffprobe evidence even if the budget check fails', async () => {
    const updateJob = jest.fn();
    const service = Object.create(JobsService.prototype) as JobsService;
    Object.assign(service, {
      findJob: () =>
        Promise.resolve({
          creditOperationId: 'op',
          creditSourceSeconds: 300,
        }),
      updateJob,
      logger: { log: jest.fn() },
      credits: {
        assertSourceBudget: jest
          .fn()
          .mockRejectedValue(new SourceAuthorizationError(300, 300.461)),
      },
    });
    await expect(
      service.assertSourceBudget('job', 300.461),
    ).rejects.toBeInstanceOf(SourceAuthorizationError);
    expect(updateJob).toHaveBeenCalledWith('job', {
      measuredSourceSeconds: 300.461,
    });
  });
  function controller(job = failed) {
    const jobs = { getJobById: jest.fn().mockResolvedValue(job) };
    const estimate = jest.fn((_user: string, source: number, output: number) =>
      Promise.resolve({
        sourceSeconds: source,
        maxOutputSeconds: output,
        ...clipPrice(source, output, INITIAL_PRICING),
      }),
    );
    const api = new JobsController(
      jobs as never,
      { findById: () => Promise.resolve({ plan: 'pro' }) } as never,
      {} as never,
      {} as never,
      { enabled: true, estimate } as never,
      { fetchVideoMetadata: () => Promise.resolve({ duration: 300 }) } as never,
    );
    return { api, jobs, estimate };
  }
  it('requires ownership and uses the saved measurement in a new quote without reserving', async () => {
    const f = controller();
    expect(
      await f.api.estimate(
        { user: { userId: 'user' } },
        { sourceUrl, reviewJobId: 'job' },
      ),
    ).toMatchObject({
      sourceSeconds: 301,
      maxOutputSeconds: 301,
      totalCredits: 8,
    });
    expect(f.jobs.getJobById).toHaveBeenCalledWith('user', 'job');
    expect(f.estimate).toHaveBeenCalledWith('user', 301, 301);
  });
  it('rejects review of another source or a non-failed job', async () => {
    for (const job of [
      { ...failed, sourceUrl: 'https://youtu.be/other' },
      { ...failed, status: JobStatus.COMPLETED },
      { ...failed, errorMessage: 'network failure' },
    ]) {
      const f = controller(job);
      await expect(
        f.api.estimate(
          { user: { userId: 'user' } },
          { sourceUrl, reviewJobId: 'job' },
        ),
      ).rejects.toThrow('original failed video');
      expect(f.estimate).not.toHaveBeenCalled();
    }
  });
});
