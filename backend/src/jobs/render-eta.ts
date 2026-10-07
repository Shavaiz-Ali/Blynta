import type { ClipRenderProgress } from './render-progress';
import {
  JobStatus,
  ClipProcessingState,
  type Clip,
} from './schemas/job.schema';

export interface RenderEtaEntry {
  clip: Clip;
  progress?: ClipRenderProgress;
  hasCaptions: boolean;
  queueState?: string;
}

export interface RenderCapacity {
  slots: number;
  active: number;
  waiting: number;
  delayed: number;
}

const MAX_ESTIMATE = 30 * 24 * 3600;
const positive = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value > 0;
const median = (values: number[]) => {
  const sorted = values.filter(positive).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length
    ? (sorted[middle] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2
    : undefined;
};

/** Seconds until this manifest is ready, based on measured phase costs and slot timelines. */
export function estimateRenderEta(
  status: string,
  entries: RenderEtaEntry[],
  capacity: RenderCapacity | null,
  now = Date.now(),
): number | null {
  if (status === 'failed' || status === 'cancelled') return null;
  if (
    entries.length &&
    entries.every(({ clip }) => clip.status === JobStatus.COMPLETED)
  )
    return 0;
  if (status !== 'cutting_clips' || !entries.length || !capacity) return null;
  if (!Number.isInteger(capacity.slots) || capacity.slots < 1) return null;
  if (entries.some(({ clip }) => clip.status === JobStatus.FAILED)) return null;
  const pending = entries.filter(
    ({ clip }) => clip.status !== JobStatus.COMPLETED,
  );
  const active = pending.filter((entry) => entry.queueState === 'active');
  const queued = pending.filter((entry) =>
    ['waiting', 'prioritized'].includes(entry.queueState ?? ''),
  );
  // Competing jobs, retry delays, paused/unregistered workers and incomplete manifests
  // have unknown schedules. Do not silently allocate their capacity to this parent.
  if (
    active.length + queued.length !== pending.length ||
    active.length > capacity.slots ||
    capacity.active !== active.length ||
    capacity.waiting !== queued.length ||
    capacity.delayed > 0
  )
    return null;

  const completed = entries.filter(
    ({ clip }) => clip.status === JobStatus.COMPLETED,
  );
  const measuredCut = completed.map(
    ({ clip }) =>
      (clip.renderTiming?.cuttingSeconds ?? 0) /
      (clip.endTime - clip.startTime),
  );
  const measuredCaption = completed
    .filter((entry) => entry.hasCaptions)
    .map(
      ({ clip }) =>
        (clip.renderTiming?.captioningSeconds ?? 0) /
        (clip.endTime - clip.startTime),
    );
  const liveCut: number[] = [];
  const liveCaption: number[] = [];
  const liveRemaining = new Map<RenderEtaEntry, number>();
  for (const entry of active) {
    const progress = entry.progress;
    const duration = entry.clip.endTime - entry.clip.startTime;
    if (
      !progress ||
      !positive(duration) ||
      !Number.isFinite(progress.updatedAt) ||
      now - progress.updatedAt > 15000 ||
      progress.updatedAt > now + 1000
    )
      return null;
    if (positive(progress.cuttingSeconds))
      liveCut.push(progress.cuttingSeconds / duration);
    if (progress.status === ClipProcessingState.UPLOADING) continue;
    if (
      !['cutting', 'captioning'].includes(progress.status) ||
      !positive(progress.processedSeconds) ||
      progress.processedSeconds < 5 ||
      progress.processedSeconds > duration
    )
      return null;
    const remaining = Math.max(0, duration - progress.processedSeconds);
    const seconds = positive(progress.speed)
      ? remaining / progress.speed
      : positive(progress.etaSeconds)
        ? progress.etaSeconds
        : undefined;
    const rate = positive(progress.speed)
      ? 1 / progress.speed
      : positive(progress.etaSeconds) && positive(remaining)
        ? progress.etaSeconds / remaining
        : undefined;
    if (seconds === undefined || !Number.isFinite(seconds)) return null;
    liveRemaining.set(entry, seconds);
    if (positive(rate))
      (progress.status === ClipProcessingState.CUTTING
        ? liveCut
        : liveCaption
      ).push(rate);
  }
  // Completed clips from this video take precedence over noisier live samples.
  const cutRate = median(measuredCut) ?? median(liveCut);
  const captionRate = median(measuredCaption) ?? median(liveCaption);
  // Setup/upload is not FFmpeg work. Until measured, reserve a modest overhead,
  // never substitute a guessed media-processing speed.
  const overhead =
    median(
      completed.map(({ clip }) => clip.renderTiming?.overheadSeconds ?? 0),
    ) ?? 30;
  const timelines: number[] = [];
  for (const entry of active) {
    const duration = entry.clip.endTime - entry.clip.startTime;
    const progress = entry.progress!;
    if (progress.status === ClipProcessingState.UPLOADING) {
      timelines.push(overhead);
    } else {
      let remaining = liveRemaining.get(entry)!;
      if (
        progress.status === ClipProcessingState.CUTTING &&
        entry.hasCaptions
      ) {
        if (!positive(captionRate)) return null;
        remaining += duration * captionRate;
      }
      timelines.push(remaining + overhead);
    }
  }
  // Only slots useful to this batch are allocated; this also bounds the calculation.
  while (timelines.length < Math.min(capacity.slots, pending.length))
    timelines.push(0);
  for (const entry of queued) {
    const duration = entry.clip.endTime - entry.clip.startTime;
    if (
      !positive(duration) ||
      !positive(cutRate) ||
      (entry.hasCaptions && !positive(captionRate))
    )
      return null;
    const work =
      duration * (cutRate + (entry.hasCaptions ? captionRate! : 0)) + overhead;
    const shortest = timelines.indexOf(Math.min(...timelines));
    timelines[shortest] += work;
  }
  const estimate = Math.max(...timelines);
  return Number.isFinite(estimate) && estimate >= 0 && estimate <= MAX_ESTIMATE
    ? Math.ceil(estimate)
    : null;
}

/** Time-weighted smoothing of fresh observations, not a ticking countdown. */
export function smoothRenderEta(
  previous: number,
  next: number,
  elapsedMs: number,
): number {
  const alpha = 1 - Math.exp(-Math.max(0, elapsedMs) / 15000);
  return Math.ceil(previous + alpha * (next - previous));
}
