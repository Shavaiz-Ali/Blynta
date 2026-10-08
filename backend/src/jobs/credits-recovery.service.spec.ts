import { CreditsRecoveryService } from './credits-recovery.service';
import { INITIAL_PRICING } from '../billing/credit-pricing';
function fixture(overrides: Record<string, unknown> = {}) {
  const op = {
    _id: 'cursor',
    operationId: 'one',
    product: 'studio',
    kind: 'studio-export',
    relatedId: 'render',
    status: 'reserved',
    authorized: 2,
    charged: 0,
    pricing: INITIAL_PRICING,
    createdAt: new Date(Date.now() - 20 * 60_000),
    updatedAt: new Date(),
    ...overrides,
  };
  const credits = {
    recoverUsage: jest.fn().mockResolvedValue(undefined),
    enabled: false,
    operations: {
      find: jest
        .fn()
        .mockReturnValue({ sort: () => ({ limit: async () => [op] }) }),
    },
    settle: jest.fn().mockResolvedValue({}),
  };
  const jobs = {
    recoverExecutionLeases: jest.fn(),
    findJob: jest.fn().mockResolvedValue(null),
    finalizeCredits: jest.fn(),
    finalizeCancellation: jest.fn(),
    enqueuePipeline: jest.fn(),
  };
  const renders = {
    findById: jest.fn().mockResolvedValue(null),
    updateOne: jest.fn(),
  };
  const queue = { getJob: jest.fn().mockResolvedValue(null), add: jest.fn() };
  const service = new CreditsRecoveryService(
    credits as never,
    jobs as never,
    renders as never,
    queue as never,
    {} as never,
  );
  return { service, credits, jobs, renders, queue };
}
describe('durable credit recovery', () => {
  test('interrupted successful export settlement charges the persisted timeline', async () => {
    const f = fixture();
    f.renders.findById.mockResolvedValue({
      status: 'completed',
      document: { clips: [{ start: 0, duration: 61 }] },
    });
    await f.service.recover();
    expect(f.credits.settle).toHaveBeenCalledWith('one', 2);
  });
  test('failed export and orphaned admission release unused holds', async () => {
    const f = fixture();
    f.renders.findById.mockResolvedValue({ status: 'failed' });
    await f.service.recover();
    expect(f.credits.settle).toHaveBeenCalledWith('one', 0);
    const orphan = fixture();
    await orphan.service.recover();
    expect(orphan.credits.settle).toHaveBeenCalledWith('one', 0);
  });
  test('queued export is redispatched after API or Redis interruption', async () => {
    const f = fixture();
    f.renders.findById.mockResolvedValue({ status: 'queued' });
    await f.service.recover();
    expect(f.queue.add).toHaveBeenCalledWith(
      'render',
      { renderId: 'render' },
      expect.objectContaining({ jobId: 'render' }),
    );
    expect(f.credits.settle).not.toHaveBeenCalled();
  });
  test('active export is not released merely because its reservation is old', async () => {
    const f = fixture();
    f.renders.findById.mockResolvedValue({ status: 'processing' });
    f.queue.getJob.mockResolvedValue({ getState: async () => 'active' });
    await f.service.recover();
    expect(f.credits.settle).not.toHaveBeenCalled();
    expect(f.queue.add).not.toHaveBeenCalled();
  });
  test('AI durable result settles; a reopened active request is not released using its old creation date', async () => {
    const delivered = fixture({ kind: 'studio-ai', result: { actions: [] } });
    await delivered.service.recover();
    expect(delivered.credits.settle).toHaveBeenCalledWith('one', 2);
    const active = fixture({
      kind: 'studio-ai',
      executionStartedAt: new Date(),
    });
    await active.service.recover();
    expect(active.credits.settle).not.toHaveBeenCalled();
  });
});
