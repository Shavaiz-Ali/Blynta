jest.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
jest.mock('ai', () => ({ generateObject: jest.fn() }));
import { StudioService } from '../studio/studio.service';
import { defaultTracks, makeClip } from '../studio/studio.contract';
import { JobsService } from '../jobs/jobs.service';
import { JobStatus } from '../jobs/schemas/job.schema';
import { INITIAL_PRICING } from './credit-pricing';

describe('real product billing admission and finalization', () => {
  const id = '507f1f77bcf86cd799439011';
  const asset = {
    id: 'asset',
    name: 'Video',
    kind: 'video' as const,
    duration: 61,
    origin: 'Upload' as const,
  };
  const document = {
    name: 'Timeline',
    ratio: '16:9' as const,
    tracks: defaultTracks,
    assets: [asset],
    clips: [makeClip(asset)],
  };
  function studio() {
    const project = { _id: id, userId: 'alice', revision: 2, document };
    const renders = {
      countDocuments: jest.fn().mockResolvedValue(0),
      findById: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(async (r: object) => ({
          ...r,
          status: 'queued',
          progress: 0,
        })),
    };
    const queue = { add: jest.fn().mockResolvedValue({}) };
    const credits = {
      enabled: true,
      pricing: () => INITIAL_PRICING,
      balance: jest
        .fn()
        .mockResolvedValue({
          enabled: true,
          available: 20,
          reserved: 0,
          pricing: INITIAL_PRICING,
        }),
      reserve: jest
        .fn()
        .mockImplementation(async (r: object) => ({
          ...r,
          relatedId: id,
          status: 'reserved',
        })),
    };
    const service = new StudioService(
      { findOne: jest.fn().mockResolvedValue(project) } as never,
      {
        find: jest
          .fn()
          .mockResolvedValue([
            {
              ...asset,
              assetId: asset.id,
              status: 'ready',
              projectId: id,
              userId: 'alice',
            },
          ]),
      } as never,
      renders as never,
      {} as never,
      {} as never,
      queue as never,
      {} as never,
      {} as never,
      credits as never,
    );
    return { service, renders, credits, queue };
  }
  test('Studio estimates the timeline extent and refuses unconfirmed export before reserving', async () => {
    const f = studio();
    const estimate = await f.service.exportEstimate('alice', id, {
      document,
      settings: { format: 'mp4', resolution: '1080p', fps: 30 },
    });
    expect(estimate.totalCredits).toBe(2);
    await expect(
      f.service.render('alice', id, {
        revision: 2,
        settings: { format: 'mp4', resolution: '1080p', fps: 30 },
      }),
    ).rejects.toThrow();
    expect(f.credits.reserve).not.toHaveBeenCalled();
  });
  test('Studio reserves before dispatch and retains durable queued intent on queue outage', async () => {
    const f = studio();
    f.queue.add.mockRejectedValue(new Error('Redis down'));
    const result = await f.service.render('alice', id, {
      revision: 2,
      settings: { format: 'mp4', resolution: '1080p', fps: 30 },
      operationId: '11111111-1111-4111-8111-111111111111',
      authorizedCredits: 2,
      pricingVersion: INITIAL_PRICING.version,
    });
    expect(result.status).toBe('queued');
    expect(f.credits.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2,
        product: 'studio',
        kind: 'studio-export',
      }),
    );
    expect(f.credits.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      f.queue.add.mock.invocationCallOrder[0],
    );
    expect(f.renders.create).toHaveBeenCalledWith(
      expect.objectContaining({ creditOperationId: expect.any(String) }),
    );
  });
  test('AI Clips finalization keeps previously delivered output after deletion and retry', async () => {
    const credits = {
      operations: {
        findOne: jest
          .fn()
          .mockResolvedValue({
            operationId: 'clips-one',
            status: 'reserved',
            charged: 13,
            pricing: INITIAL_PRICING,
            deliveredOutputs: [{ id: 'deleted', seconds: 45 }],
          }),
      },
      settle: jest.fn(),
    };
    const service = Object.create(JobsService.prototype) as JobsService;
    Object.assign(service, {
      credits,
      findJob: jest
        .fn()
        .mockResolvedValue({
          creditOperationId: 'clips-one',
          status: JobStatus.FAILED,
          videoDuration: 3600,
          activeExecutions: [],
          clips: [
            {
              _id: 'new',
              status: JobStatus.COMPLETED,
              r2ObjectKey: 'delivered.mp4',
              startTime: 0,
              endTime: 45,
            },
          ],
        }),
    });
    await service.finalizeCredits(id);
    expect(credits.settle).toHaveBeenCalledWith('clips-one', 14, [
      { id: 'deleted', seconds: 45 },
      { id: 'new', seconds: 45 },
    ]);
  });
  test('AI Clips refuses settlement while a worker still owns execution', async () => {
    const service = Object.create(JobsService.prototype) as JobsService;
    const credits = { settle: jest.fn() };
    Object.assign(service, {
      credits,
      findJob: jest
        .fn()
        .mockResolvedValue({
          creditOperationId: 'clips-one',
          status: JobStatus.CANCELLED,
          activeExecutions: ['worker'],
        }),
    });
    await service.finalizeCredits(id);
    expect(credits.settle).not.toHaveBeenCalled();
  });
});

test('new admission cannot fall back to a one-credit debit when billing is disabled', async () => {
  const service = Object.create(JobsService.prototype) as JobsService;
  const deductCredit = jest.fn();
  Object.assign(service, {
    credits: { enabled: false },
    usersService: { deductCredit },
  });
  await expect(service.createJob('alice', {} as never)).rejects.toThrow(
    'Usage-based billing is not active',
  );
  expect(deductCredit).not.toHaveBeenCalled();
});
