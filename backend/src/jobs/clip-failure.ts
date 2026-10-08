import { Clip } from './schemas/job.schema';

// Only allow curated explanations into the public API. Internal errors stay in Mongo/logs.
export function clipFailure(clip: Clip, sourceAvailable?: boolean) {
  const stages: Record<string, string> = {
    cutting: 'Cutting video',
    captioning: 'Adding captions',
    uploading: 'Uploading',
    source_download: 'Preparing video',
    worker: 'Processing clip',
  };
  const stage = stages[clip.errorStage ?? ''];
  const raw = clip.errorMessage ?? '';
  const sourceMissing = sourceAvailable === false;
  const reason = sourceMissing
    ? 'The original video is no longer available. Add the video again to create this clip.'
    : /stall|interrupt|shutdown|no live|worker/i.test(raw)
      ? 'Processing was interrupted before this clip finished. Try again to resume it.'
      : /timeout|timed out|network|ECONN/i.test(raw)
        ? 'The connection was interrupted while processing this clip. Please try again.'
        : clip.errorStage === 'captioning'
          ? 'Captions could not be added to this clip. Try rendering it again.'
          : clip.errorStage === 'uploading'
            ? 'This clip could not be saved. Try uploading it again.'
            : clip.errorStage === 'cutting'
              ? 'This video segment could not be rendered. Try creating the clip again.'
              : clip.errorStage === 'source_download'
                ? 'The original video could not be loaded. Please try again.'
                : 'This clip stopped before it was ready. Retry to create it again.';
  const summaries: Record<string, string> = {
    cutting: 'This video segment could not be rendered.',
    captioning: 'Captions could not be added to this clip.',
    uploading: 'This clip could not be saved.',
    source_download: 'The original video could not be loaded.',
    worker: 'Processing was interrupted before this clip finished.',
  };
  const message = sourceMissing
    ? reason
    : (summaries[clip.errorStage ?? ''] ?? reason);
  return {
    message,
    ...(message !== reason ? { reason } : {}),
    ...(stage ? { stage } : {}),
    ...(clip.failedAt ? { failedAt: clip.failedAt } : {}),
    ...(clip.attemptCount ? { attempt: clip.attemptCount } : {}),
    ...(sourceAvailable !== undefined
      ? { retryAvailable: sourceAvailable }
      : {}),
  };
}
