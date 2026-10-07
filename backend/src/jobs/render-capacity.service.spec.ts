import { Queue, Worker, type IRedisClient } from 'bullmq';
import { RenderCapacityService } from './render-capacity.service';

describe('effective render capacity across worker processes', () => {
  const registry = new Set<string>();
  const client = {
    defineCommand: jest.fn(),
    runCommand: jest.fn((name: string, args: (string | number)[]) => {
      if (name === 'blyntaEtaHeartbeatV1') {
        if (args[2]) registry.delete(String(args[2]));
        registry.add(String(args[1]));
        return Promise.resolve(1);
      }
      if (name === 'blyntaEtaRemoveWorkerV1') {
        registry.delete(String(args[1]));
        return Promise.resolve(1);
      }
      return Promise.resolve([...registry]);
    }),
  };
  const queue = {
    client: Promise.resolve(client as unknown as IRedisClient),
    toKey: (suffix: string) => `test:render:${suffix}`,
    isPaused: jest.fn(() => Promise.resolve(false)),
    getGlobalConcurrency: jest.fn<Promise<number | null>, []>(() =>
      Promise.resolve(null),
    ),
    getJobCounts: jest.fn(() =>
      Promise.resolve({ active: 2, waiting: 3, prioritized: 2, delayed: 0 }),
    ),
  };
  const worker = (slots: number) =>
    ({
      concurrency: slots,
      isRunning: () => true,
      isPaused: () => false,
    }) as Worker;
  let a: RenderCapacityService,
    b: RenderCapacityService,
    api: RenderCapacityService;
  beforeEach(() => {
    jest.useFakeTimers();
    registry.clear();
    jest.clearAllMocks();
    queue.isPaused.mockResolvedValue(false);
    queue.getGlobalConcurrency.mockResolvedValue(null);
    a = new RenderCapacityService(queue as unknown as Queue);
    b = new RenderCapacityService(queue as unknown as Queue);
    api = new RenderCapacityService(queue as unknown as Queue);
  });
  afterEach(async () => {
    await a.onModuleDestroy();
    await b.onModuleDestroy();
    await api.onModuleDestroy();
    jest.useRealTimers();
  });
  it('adds heterogeneous workers and respects a queue-level concurrency ceiling', async () => {
    await a.startWorker(worker(2));
    await b.startWorker(worker(3));
    expect(await api.snapshot()).toEqual({
      slots: 5,
      active: 2,
      waiting: 5,
      delayed: 0,
    });
    queue.getGlobalConcurrency.mockResolvedValue(4);
    await jest.advanceTimersByTimeAsync(5001);
    expect((await api.snapshot())?.slots).toBe(4);
  });
  it('coalesces concurrent metrics reads and caches them for five seconds', async () => {
    await a.startWorker(worker(2));
    await Promise.all([api.snapshot(), api.snapshot(), api.snapshot()]);
    await api.snapshot();
    expect(queue.getJobCounts).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(5001);
    await api.snapshot();
    expect(queue.getJobCounts).toHaveBeenCalledTimes(2);
  });
  it('removes shutdown workers and fails closed with no registered capacity', async () => {
    await a.startWorker(worker(2));
    await a.onModuleDestroy();
    expect(await api.snapshot()).toBeNull();
  });
  it('advertises changed/paused local capacity without double-counting a worker', async () => {
    const instance = worker(2);
    await a.startWorker(instance);
    instance.concurrency = 3;
    await jest.advanceTimersByTimeAsync(10001);
    expect(registry.size).toBe(1);
    expect((await api.snapshot())?.slots).toBe(3);
    instance.isPaused = () => true;
    await jest.advanceTimersByTimeAsync(10001);
    expect(await api.snapshot()).toBeNull();
  });
  it('suppresses globally paused queues and unavailable metric storage', async () => {
    await a.startWorker(worker(2));
    queue.isPaused.mockResolvedValue(true);
    expect(await api.snapshot()).toBeNull();
    queue.getJobCounts.mockRejectedValueOnce(new Error('Redis unavailable'));
    await jest.advanceTimersByTimeAsync(5001);
    expect(await api.snapshot()).toBeNull();
  });
});
