export const EDIT_QUEUE = 'edit-render';
export const EDIT_RENDER_JOB = 'EDIT_RENDER_PREVIEW';
export const EDIT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 3000 },
  removeOnComplete: { age: 86400, count: 1000 },
  removeOnFail: { age: 604800, count: 1000 },
} as const;
export const EDIT_LIMITS = {
  SOURCE_MAX_BYTES: 500 * 1024 * 1024,
  OUTPUT_MAX_BYTES: 200 * 1024 * 1024,
  RENDER_TIMEOUT_SECONDS: 1800,
} as const;
