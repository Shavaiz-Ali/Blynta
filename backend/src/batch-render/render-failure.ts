import { UnrecoverableError } from 'bullmq';
import { isObjectMissing } from '../storage/r2-object-context';
import { ProcessingCancelled } from '../jobs/cancellation-context';

export const RENDER_FAILURE_CODES = [
  'RENDER_MANIFEST_UPLOAD_FAILED',
  'RENDER_BATCH_SUBMISSION_FAILED',
  'RENDER_BATCH_START_FAILED',
  'RENDER_SOURCE_NOT_FOUND',
  'RENDER_MANIFEST_NOT_FOUND',
  'RENDER_MANIFEST_INVALID',
  'RENDER_MANIFEST_DOWNLOAD_FAILED',
  'RENDER_FFMPEG_FAILED',
  'RENDER_OUTPUT_UPLOAD_FAILED',
  'RENDER_OUTPUT_NOT_FOUND',
  'RENDER_OUTPUT_INVALID',
  'RENDER_TIMEOUT',
  'RENDER_BATCH_FAILED',
  'RENDER_PREVIOUS_ATTEMPT_ACTIVE',
] as const;
export type RenderFailureCode = (typeof RENDER_FAILURE_CODES)[number];
export interface RenderFailureDetail {
  code: RenderFailureCode;
  stage: string;
  retryable: boolean;
}
type AnnotatedError = Error & { renderFailure: RenderFailureDetail };

export function renderFailure(
  error: unknown,
  stage = 'startup',
): RenderFailureDetail {
  const stored = (error as Partial<AnnotatedError> | null)?.renderFailure;
  if (stored) return stored;
  if (error instanceof ProcessingCancelled)
    return { code: 'RENDER_TIMEOUT', stage: 'timeout', retryable: false };
  const missing = isObjectMissing(error);
  const codes: Record<string, RenderFailureCode> = {
    manifest_upload: 'RENDER_MANIFEST_UPLOAD_FAILED',
    submission: 'RENDER_BATCH_SUBMISSION_FAILED',
    manifest_download: missing
      ? 'RENDER_MANIFEST_NOT_FOUND'
      : error instanceof SyntaxError || error instanceof UnrecoverableError
        ? 'RENDER_MANIFEST_INVALID'
        : 'RENDER_MANIFEST_DOWNLOAD_FAILED',
    source_check: missing
      ? 'RENDER_SOURCE_NOT_FOUND'
      : 'RENDER_BATCH_START_FAILED',
    cutting: 'RENDER_FFMPEG_FAILED',
    captioning: 'RENDER_FFMPEG_FAILED',
    encoding: 'RENDER_FFMPEG_FAILED',
    output_upload: 'RENDER_OUTPUT_UPLOAD_FAILED',
    media_verification: 'RENDER_OUTPUT_INVALID',
    output_verification: missing
      ? 'RENDER_OUTPUT_NOT_FOUND'
      : 'RENDER_OUTPUT_INVALID',
    timeout: 'RENDER_TIMEOUT',
  };
  return {
    code: codes[stage] ?? 'RENDER_BATCH_START_FAILED',
    stage,
    retryable:
      !(error instanceof UnrecoverableError) &&
      !(error instanceof SyntaxError) &&
      !missing,
  };
}

export function annotateRenderFailure(error: unknown, stage: string): unknown {
  if (error instanceof Error && !('renderFailure' in error))
    Object.assign(error, { renderFailure: renderFailure(error, stage) });
  return error;
}

export function terminalRenderFailure(
  detail: RenderFailureDetail,
): AnnotatedError {
  return Object.assign(
    new UnrecoverableError(`${detail.code}: Render could not be completed.`),
    { renderFailure: detail },
  );
}

export function validFailure(value: unknown): value is RenderFailureDetail {
  const record = value as Partial<RenderFailureDetail> | null;
  return (
    !!record &&
    RENDER_FAILURE_CODES.includes(record.code as RenderFailureCode) &&
    typeof record.stage === 'string' &&
    /^[a-z_]{1,40}$/.test(record.stage) &&
    typeof record.retryable === 'boolean'
  );
}
