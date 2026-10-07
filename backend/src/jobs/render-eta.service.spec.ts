import { Types } from 'mongoose';
import { Queue, type IRedisClient } from 'bullmq';
import { RenderEtaService } from './render-eta.service';
import { RenderCapacityService } from './render-capacity.service';
import {
  JobStatus,
  ClipProcessingState,
  type Clip,
} from './schemas/job.schema';
import { smoothRenderEta, type RenderEtaEntry } from './render-eta';

describe('shared parent ETA smoothing and response isolation', () => {
  const states = new Map<
    string,
    { signature: string; value: number; at: number }
  >();
  const client = {
    defineCommand: jest.fn(),
    del: jest.fn((key: string) => {
      states.delete(key);
      return Promise.resolve(1);
    }),
    runCommand: jest.fn((_name: string, args: (string | number)[]) => {
      const [key, raw, signature] = args as [string, number, string];
      const old = states.get(key);
      if (old?.signature === signature) return Promise.resolve(old.value);
      const value = old
        ? smoothRenderEta(old.value, raw, Date.now() - old.at)
        : raw;
      states.set(key, { signature, value, at: Date.now() });
      return Promise.resolve(value);
    }),
  };
  const queue = {
    client: Promise.resolve(client as unknown as IRedisClient),
    toKey: (key: string) => `test:${key}`,
  };
  const capacity = {
    snapshot: jest.fn(() =>
      Promise.resolve({ slots: 2, active: 1, waiting: 1, delayed: 0 }),
    ),
  };
  const entry = (): RenderEtaEntry => {
    const clip = {
      _id: new Types.ObjectId(),
      status: JobStatus.CUTTING_CLIPS,
      startTime: 0,
      endTime: 50,
    } as Clip;
    return {
      clip,
      queueState: 'active',
      hasCaptions: true,
      progress: {
        clipId: clip._id.toString(),
        status: ClipProcessingState.CAPTIONING,
        progress: 40,
        renderProgress: 65,
        processedSeconds: 20,
        durationSeconds: 50,
        etaSeconds: 100,
        speed: 0.3,
        cuttingSeconds: 50,
        updatedAt: Date.now(),
      },
    };
  };
  const service = () =>
    new RenderEtaService(
      capacity as unknown as RenderCapacityService,
      queue as unknown as Queue,
    );
  beforeEach(() => {
    jest.useFakeTimers();
    states.clear();
    jest.clearAllMocks();
    capacity.snapshot.mockResolvedValue({
      slots: 2,
      active: 1,
      waiting: 1,
      delayed: 0,
    });
  });
  afterEach(() => jest.useRealTimers());
  it('shares smoothing between API replicas and never smooths repeatedly for identical polls', async () => {
    const entries = [
      entry(),
      { ...entry(), queueState: 'waiting', progress: undefined },
    ];
    const first = await service().estimate('a', 'cutting_clips', entries);
    jest.advanceTimersByTime(1000);
    entries[0].progress!.speed = 0.03;
    entries[0].progress!.updatedAt = Date.now();
    const changed = await service().estimate('a', 'cutting_clips', entries);
    expect(changed).toBeGreaterThan(first!);
    expect(changed).toBeLessThan(1000);
    jest.advanceTimersByTime(1000);
    entries[1].progress = { ...entry().progress!, updatedAt: Date.now() }; // Synthetic queued timestamp is not an observation.
    const sameSignature = entries[1].progress;
    sameSignature.speed = undefined;
    sameSignature.etaSeconds = undefined;
    expect(await service().estimate('a', 'cutting_clips', entries)).toBe(
      changed,
    );
    expect(
      await service().estimate('b', 'cutting_clips', entries),
    ).toBeGreaterThan(changed!);
  });
  it('clears unreliable estimates, returns completed zero independently of Redis, and suppresses failures', async () => {
    const entries = [entry()];
    capacity.snapshot.mockResolvedValue({
      slots: 1,
      active: 1,
      waiting: 0,
      delayed: 0,
    });
    await service().estimate('a', 'cutting_clips', entries);
    expect(states.size).toBe(1);
    expect(await service().estimate('a', 'failed', entries)).toBeNull();
    expect(await service().estimate('a', 'cancelled', entries)).toBeNull();
    entries[0].clip.status = JobStatus.COMPLETED;
    const offline = { ...queue, client: Promise.reject(new Error('offline')) };
    const result = await new RenderEtaService(
      capacity as unknown as RenderCapacityService,
      offline as unknown as Queue,
    ).estimate('a', 'completed', entries);
    expect(result).toBe(0);
  });
  it('does not break progress when ETA storage is unavailable', async () => {
    capacity.snapshot.mockResolvedValue({
      slots: 1,
      active: 1,
      waiting: 0,
      delayed: 0,
    });
    client.runCommand.mockRejectedValueOnce(new Error('Redis unavailable'));
    expect(
      await service().estimate('a', 'cutting_clips', [entry()]),
    ).toBeNull();
  });
});
