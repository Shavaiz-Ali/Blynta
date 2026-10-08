import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { randomUUID } from 'node:crypto';
import { Queue, Worker } from 'bullmq';
import { RENDER_QUEUE } from './jobs.constants';
import type { RenderCapacity } from './render-eta';
import { runEtaScript } from './render-eta-redis';

// Redis time avoids clock skew between API replicas and render workers.
const heartbeatScript = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
if ARGV[2] ~= '' then redis.call('ZREM', KEYS[1], ARGV[2]) end
redis.call('ZADD', KEYS[1], now + 30000, ARGV[1])
redis.call('EXPIRE', KEYS[1], 60)
return 1`;
const capacityScript = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
return redis.call('ZRANGEBYSCORE', KEYS[1], now + 1, '+inf')`;

/** Replaceable backend capacity source; every live worker advertises its actual slots. */
@Injectable()
export class RenderCapacityService implements OnModuleDestroy {
  private readonly logger = new Logger(RenderCapacityService.name);
  private timer?: ReturnType<typeof setInterval>;
  private member?: string;
  private cached?: { at: number; value: RenderCapacity | null };
  private reading?: Promise<RenderCapacity | null>;
  private publishing?: Promise<void>;
  private stopped = false;
  constructor(@InjectQueue(RENDER_QUEUE) private readonly queue: Queue) {}

  async setGlobalConcurrency(limit: number): Promise<void> {
    await this.queue.setGlobalConcurrency(limit);
  }

  async startWorker(worker: Worker): Promise<void> {
    const id = randomUUID();
    const publish = async () => {
      const client = await this.queue.client;
      const slots =
        worker.isRunning() && !worker.isPaused() ? worker.concurrency : 0;
      const member = JSON.stringify({ id, slots });
      const previous = this.member;
      this.member = member;
      await runEtaScript(client, 'blyntaEtaHeartbeatV1', heartbeatScript, [
        this.queue.toKey('eta:capacity'),
        member,
        previous && previous !== member ? previous : '',
      ]);
    };
    const heartbeat = () => {
      if (this.stopped || this.publishing) return;
      this.publishing = publish()
        .catch((error: unknown) => {
          this.logger.warn(`Render capacity unavailable: ${String(error)}`);
        })
        .finally(() => {
          this.publishing = undefined;
        });
    };
    heartbeat();
    await this.publishing;
    if (!this.stopped) {
      this.timer = setInterval(heartbeat, 10000);
      this.timer.unref();
    }
  }

  async snapshot(): Promise<RenderCapacity | null> {
    if (this.cached && Date.now() - this.cached.at < 5000)
      return this.cached.value;
    if (this.reading) return this.reading;
    this.reading = this.read()
      .catch(() => null)
      .then((value) => {
        this.cached = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        this.reading = undefined;
      });
    return this.reading;
  }

  private async read(): Promise<RenderCapacity | null> {
    const client = await this.queue.client;
    const [members, counts, paused, globalLimit] = await Promise.all([
      runEtaScript(client, 'blyntaEtaCapacityV1', capacityScript, [
        this.queue.toKey('eta:capacity'),
      ]) as Promise<string[]>,
      this.queue.getJobCounts('active', 'waiting', 'prioritized', 'delayed'),
      this.queue.isPaused(),
      this.queue.getGlobalConcurrency(),
    ]);
    if (paused) return null;
    let slots = 0;
    for (const member of members) {
      const entry = JSON.parse(member) as { slots?: number };
      if (
        Number.isInteger(entry.slots) &&
        entry.slots! >= 0 &&
        entry.slots! <= 8
      )
        slots += entry.slots!;
    }
    if (globalLimit !== null && globalLimit !== undefined)
      slots = Math.min(slots, globalLimit);
    return slots > 0
      ? {
          slots,
          active: counts.active ?? 0,
          waiting: (counts.waiting ?? 0) + (counts.prioritized ?? 0),
          delayed: counts.delayed ?? 0,
        }
      : null;
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.publishing;
    if (this.member) {
      try {
        const client = await this.queue.client;
        await runEtaScript(
          client,
          'blyntaEtaRemoveWorkerV1',
          "return redis.call('ZREM', KEYS[1], ARGV[1])",
          [this.queue.toKey('eta:capacity'), this.member],
        );
      } catch {
        /* Heartbeat expiry handles a lost Redis connection. */
      }
    }
  }
}
