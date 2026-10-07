export const JOBS_QUEUE = 'clip-jobs';
export const RENDER_QUEUE = 'clip-renders';
export const RENDER_CLIP = 'render-clip';
export const pipelineJobId = (jobId: string) => `pipeline-${jobId}`;
export const renderJobId = (jobId: string, clipId: string) =>
  `render-${jobId}-${clipId}`;
export const MEDIA_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: false,
  removeOnFail: false,
} as const;

export function workerConcurrency(value: unknown, name: string): number {
  const parsed =
    value === undefined
      ? 1
      : typeof value === 'string' || typeof value === 'number'
        ? Number(value)
        : NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8) {
    throw new Error(`${name} must be an integer between 1 and 8`);
  }
  return parsed;
}

export const JOBS_TYPES = {
  CLIP_VIDEO: 'clip-video',
};

export const ALLOWED_PAID_AI_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-5-sonnet',
  'claude-3-opus',
];
