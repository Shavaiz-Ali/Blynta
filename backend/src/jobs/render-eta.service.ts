import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RENDER_QUEUE } from './jobs.constants';
import { RenderCapacityService } from './render-capacity.service';
import { estimateRenderEta, type RenderEtaEntry } from './render-eta';
import { runEtaScript } from './render-eta-redis';

// Smoothing state lives beside BullMQ progress, shared across API replicas. Identical
// observations never advance smoothing or decrement ETA just because somebody polls.
const smoothScript = `
local raw = tonumber(ARGV[1])
local signature = ARGV[2]
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local previous = redis.call('GET', KEYS[1])
local value = raw
if previous then
  local old = cjson.decode(previous)
  if old.signature == signature then return old.value end
  local elapsed = math.max(0, now - old.at)
  local alpha = 1 - math.exp(-elapsed / 15000)
  value = math.ceil(old.value + alpha * (raw - old.value))
end
redis.call('SET', KEYS[1], cjson.encode({value=value, at=now, signature=signature}), 'EX', 120)
return value`;

@Injectable()
export class RenderEtaService {
  constructor(
    private readonly capacity: RenderCapacityService,
    @InjectQueue(RENDER_QUEUE) private readonly queue: Queue,
  ) {}

  async estimate(
    jobId: string,
    status: string,
    entries: RenderEtaEntry[],
  ): Promise<number | null> {
    const key = this.queue.toKey(`eta:parent:${jobId}`);
    const clear = async () => {
      const client = await this.queue.client;
      await client.del(key);
    };
    const complete = estimateRenderEta(status, entries, null) === 0;
    if (complete || status !== 'cutting_clips') {
      void clear().catch(() => undefined);
      return complete ? 0 : null;
    }
    try {
      const capacity = await this.capacity.snapshot();
      const raw = estimateRenderEta(status, entries, capacity);
      if (raw === null || raw === 0) {
        void clear().catch(() => undefined);
        return raw;
      }
      const client = await this.queue.client;
      const signature = JSON.stringify({
        capacity,
        clips: entries.map(({ clip, progress, queueState }) => [
          clip._id.toString(),
          clip.status,
          queueState,
          queueState === 'active' ? progress?.updatedAt : undefined,
          progress?.speed,
          progress?.etaSeconds,
          clip.renderTiming,
        ]),
      });
      const value = await runEtaScript(
        client,
        'blyntaEtaSmoothV1',
        smoothScript,
        [key, raw, signature],
      );
      return typeof value === 'number' && Number.isFinite(value) ? value : null;
    } catch {
      return null;
    } // ETA availability must never break progress or processing.
  }
}
