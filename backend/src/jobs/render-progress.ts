import { Clip, ClipProcessingState, JobStatus } from './schemas/job.schema';
import { FfmpegProgress } from '../media/utils/ffmpeg-progress';

export interface ClipRenderProgress extends Partial<FfmpegProgress> {
  clipId: string;
  status: ClipProcessingState;
  progress: number;
  renderProgress: number;
  updatedAt: number;
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
    const value =
      completed || failure
        ? 100
        : Math.max(0, Math.min(100, progress?.renderProgress ?? 0));
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
      progress: completed || failure ? 100 : (progress?.progress ?? 0),
      renderProgress: value,
      durationSeconds: seconds,
      ...(completed || failure ? {} : progress),
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
