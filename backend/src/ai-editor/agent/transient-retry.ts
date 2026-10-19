import type { CallFailure } from '../../ai-registry/call-diagnostics';

export const MODEL_CALL_LIMIT = 3;
export const EXECUTION_DEADLINE_MS = 90000;
export function transientRetryDelay(
  failure: CallFailure,
  input: {
    calls: number;
    reserveCalls: number;
    attempt: number;
    deadlineAt: number;
    now?: number;
    random?: number;
  },
): number | undefined {
  if (
    !failure.retryable ||
    !['provider_http', 'transport'].includes(failure.origin) ||
    !['provider', 'quota', 'network', 'timeout'].includes(failure.category) ||
    (failure.upstreamStatus !== undefined &&
      ![408, 429, 500, 502, 503, 504].includes(failure.upstreamStatus)) ||
    input.calls + input.reserveCalls >= MODEL_CALL_LIMIT ||
    input.attempt >= 2
  )
    return undefined;
  const delay =
    Math.min(2000, 500 * 2 ** input.attempt) +
    Math.floor((input.random ?? Math.random()) * 250);
  return input.deadlineAt - (input.now ?? Date.now()) >= delay + 1000
    ? delay
    : undefined;
}
