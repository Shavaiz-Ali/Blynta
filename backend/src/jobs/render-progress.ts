import { Clip, ClipProcessingState, JobStatus } from './schemas/job.schema';
import { FfmpegProgress } from '../media/utils/ffmpeg-progress';

export interface ClipRenderProgress extends Partial<FfmpegProgress> {
  clipId: string;
  status: ClipProcessingState;
  progress: number;
  stageProgress?: number;
  etaScope?: 'stage';
  renderProgress: number;
  updatedAt: number;
  cuttingSeconds?: number;
  hasCaptions?: boolean;
}

const percent = (value: number | undefined) =>
  Number.isFinite(value) ? Math.max(0, Math.min(100, value!)) : 0;

export function overallClipProgress(
  status: ClipProcessingState,
  stage: number,
) {
  const value = percent(stage);
  switch (status) {
    case ClipProcessingState.CUTTING:
      return value * 0.3;
    case ClipProcessingState.CAPTIONING:
      return 30 + value * 0.6;
    case ClipProcessingState.UPLOADING:
      return 90 + value * 0.1;
    case ClipProcessingState.READY:
      return 100;
    default:
      return 0;
  }
}

/** Also translates progress written by workers before stageProgress was introduced. */
export function clipOverallValue(progress?: ClipRenderProgress): number {
  if (!progress) return 0;
  return progress.stageProgress === undefined
    ? overallClipProgress(progress.status, progress.progress)
    : percent(progress.progress);
}

export function clipProgressSample(
  base: Pick<
    ClipRenderProgress,
    'clipId' | 'status' | 'durationSeconds' | 'cuttingSeconds' | 'hasCaptions'
  >,
  sample?: FfmpegProgress,
  previous?: ClipRenderProgress,
): ClipRenderProgress {
  // Out-of-order FFmpeg observations within an operation are discarded in full.
  if (
    sample &&
    previous?.status === base.status &&
    percent(sample.progress) < percent(previous.stageProgress)
  )
    return previous;
  const stageProgress = percent(sample?.progress);
  const progress = Math.max(
    clipOverallValue(previous),
    overallClipProgress(base.status, stageProgress),
  );
  const etaSeconds = sample?.etaSeconds;
  return {
    ...sample,
    ...base,
    stageProgress,
    progress,
    renderProgress: progress,
    etaSeconds:
      etaSeconds !== undefined && Number.isFinite(etaSeconds) && etaSeconds >= 0
        ? etaSeconds
        : undefined,
    etaScope: 'stage',
    updatedAt: Date.now(),
  };
}

export function renderSnapshot(
  entries: { clip: Clip; progress?: ClipRenderProgress }[],
) {
  let weighted = 0;
  let duration = 0;
  let ready = 0;
  let failed = 0;
  const clips = entries.map(({ clip, progress }) => {
    const seconds = Math.max(0.001, clip.endTime - clip.startTime);
    const completed = clip.status === JobStatus.COMPLETED;
    const failure = clip.status === JobStatus.FAILED;
    ready += completed ? 1 : 0;
    failed += failure ? 1 : 0;
    const value = completed || failure ? 100 : clipOverallValue(progress);
    weighted += value * seconds;
    duration += seconds;
    return {
      clipId: clip._id.toString(),
      status: completed
        ? ClipProcessingState.READY
        : failure
          ? ClipProcessingState.FAILED
          : (progress?.status ??
            clip.processingState ??
            ClipProcessingState.QUEUED),
      durationSeconds: seconds,
      ...(completed || failure ? {} : progress),
      progress: value,
      renderProgress: value,
      stageProgress: progress?.stageProgress ?? progress?.progress ?? 0,
      etaScope: 'stage' as const,
    };
  });
  return {
    ready,
    failed,
    total: entries.length,
    progressPercent: duration ? Math.round(weighted / duration) : 0,
    clips,
  };
}
