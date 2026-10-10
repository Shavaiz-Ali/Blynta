import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { JobsService } from './jobs.service';
import { INITIAL_PRICING, clipPrice } from '../billing/credit-pricing';
import { SourcePlatform } from './schemas/job.schema';
const userId = '111111111111111111111111',
  modelId = '222222222222222222222222',
  jobId = '333333333333333333333333';
function setup() {
  const savedRows: Row[] = [];
  class Row {
    _id!: Types.ObjectId;
    constructor(body: object) {
      Object.assign(this, body);
    }
    save() {
      savedRows.push(this);
      return Promise.resolve(this);
    }
    static findById() {
      return { exec: () => Promise.resolve(savedRows.at(-1) ?? null) };
    }
  }
  const selection = {
    registryId: modelId,
    providerId: modelId,
    modelId: 'gemini-selected',
    configurationHash: 'model-config',
    auto: false,
  };
  const routing = { select: jest.fn().mockResolvedValue(selection) };
  const credits = {
    enabled: true,
    pricing: () => INITIAL_PRICING,
    reserve: jest
      .fn()
      .mockResolvedValue({ relatedId: jobId, status: 'reserved' }),
  };
  const activities = { queueCreate: jest.fn().mockResolvedValue(undefined) };
  const service = new JobsService(
    ...([
      Row,
      {},
      {},
      {
        findById: jest.fn().mockResolvedValue({ plan: 'pro', isActive: true }),
      },
      new ConfigService(),
      {},
      activities,
      {},
      undefined,
      credits,
      routing,
    ] as unknown as ConstructorParameters<typeof JobsService>),
  );
  const enqueue = jest
    .spyOn(service, 'enqueuePipeline')
    .mockResolvedValue(undefined);
  const body = {
    sourceUrl: 'https://youtube.com/watch?v=fixture',
    sourcePlatform: SourcePlatform.YOUTUBE,
    modelId,
    operationId: '11111111-1111-4111-8111-111111111111',
    sourceSeconds: 60,
    maxOutputSeconds: 60,
    authorizedCredits: clipPrice(60, 60).totalCredits,
    pricingVersion: INITIAL_PRICING.version,
  };
  return { service, body, routing, credits, selection, enqueue };
}
describe('hero model selection reaches durable highlight jobs', () => {
  it('stores only resolved identity and preserves authorized credit amounts and idempotency', async () => {
    const s = setup();
    const first = await s.service.createJob(userId, s.body);
    const again = await s.service.createJob(userId, s.body);
    expect(first.highlightModel).toEqual(s.selection);
    expect(again).toBe(first);
    expect(s.routing.select).toHaveBeenCalledWith(userId, modelId);
    expect(s.credits.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2,
        product: 'ai-clips',
        sourceSeconds: 60,
        maxOutputSeconds: 60,
      }),
    );
    expect(s.enqueue).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(first)).not.toMatch(/secret|ciphertext/);
  });
  it('rejects unauthorized database model selections before reserving credits', async () => {
    const s = setup();
    s.routing.select.mockRejectedValue(
      new ForbiddenException('Free accounts use Auto'),
    );
    await expect(s.service.createJob(userId, s.body)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(s.credits.reserve).not.toHaveBeenCalled();
  });
  it('rejects external model identifiers instead of bypassing registry policy', async () => {
    const s = setup();
    await expect(
      s.service.createJob(userId, { ...s.body, aiModel: 'unregistered-model' }),
    ).rejects.toThrow('registered model selection');
    expect(s.credits.reserve).not.toHaveBeenCalled();
  });
});
