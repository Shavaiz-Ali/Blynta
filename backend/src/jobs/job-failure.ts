import { SourcePlatform } from './schemas/job.schema';
import { requiresSourceApproval } from '../billing/source-authorization';

/** Public explanations only. The original diagnostic remains in storage/logs. */
export function jobFailure(job: {
  errorMessage?: string;
  errorStage?: string;
  sourcePlatform?: SourcePlatform;
}) {
  if (!job.errorMessage) return undefined;
  const raw = job.errorMessage;
  if (requiresSourceApproval(raw))
    return {
      code: 'source_authorization_required',
      message:
        'The downloaded video needs a revised source budget. Retrying cannot change your approval. Review a new estimate and explicitly approve it to start a new job.',
      retryAvailable: false,
      requiresApproval: true,
    };
  const preparation = [
    'pending',
    'download',
    'preparing',
    'source_download',
  ].includes(job.errorStage ?? '');
  let code = 'processing_failed';
  let message =
    'We couldn’t finish processing this video. Retry processing to continue from the last completed stage.';
  if (preparation) {
    if (
      /video unavailable|video has been removed|video has been deleted|private video|not available in your country|copyright|video not found|HTTP Error 404/i.test(
        raw,
      )
    ) {
      code = 'source_unavailable';
      message =
        'This video is unavailable or restricted. Check the source link or try another video.';
    } else if (
      job.sourcePlatform === SourcePlatform.YOUTUBE &&
      /requires YouTube authentication cookies|sign in to confirm|login required|authentication required/i.test(
        raw,
      )
    ) {
      code = 'source_authentication_required';
      message =
        'Couldn’t access this YouTube video. The source may require authentication. Please try again later.';
    } else if (
      /ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|timed out|network is unreachable|connection reset|temporary failure in name resolution/i.test(
        raw,
      )
    ) {
      code = 'network_error';
      message =
        'The connection was interrupted while preparing this video. Please retry in a moment.';
    } else {
      code = 'preparation_failed';
      message =
        'We couldn’t prepare this video for processing. Please retry, or try another source video.';
    }
  } else if (['transcribing', 'transcription'].includes(job.errorStage ?? '')) {
    message =
      'We couldn’t generate the transcript for this video. Retry processing to continue.';
  } else if (
    ['detecting_highlights', 'highlight_detection'].includes(
      job.errorStage ?? '',
    )
  ) {
    message =
      'We couldn’t finish finding the best moments. Retry processing to continue.';
  }
  return { code, message };
}
