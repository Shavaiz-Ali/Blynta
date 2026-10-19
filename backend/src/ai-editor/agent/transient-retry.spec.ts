import type { CallFailure } from '../../ai-registry/call-diagnostics';
import { transientRetryDelay } from './transient-retry';

describe('Transient retries obey the proposal budget and deadline', () => {
  const options = {
    calls: 1,
    reserveCalls: 0,
    attempt: 0,
    now: 1000,
    deadlineAt: 90000,
    random: 0,
  };
  const failure: CallFailure = {
    code: 'AI_PROVIDER_FAILED',
    category: 'provider',
    origin: 'provider_http',
    upstreamStatus: 503,
    retryable: true,
  };
  it.each([429, 500, 502, 503, 504])(
    'backs off transient HTTP %s with bounded jitter',
    (upstreamStatus) => {
      expect(
        transientRetryDelay(
          {
            ...failure,
            upstreamStatus,
            category: upstreamStatus === 429 ? 'quota' : 'provider',
          },
          options,
        ),
      ).toBe(500);
      expect(
        transientRetryDelay(failure, {
          ...options,
          calls: 2,
          attempt: 1,
          random: 0.5,
        }),
      ).toBe(1125);
    },
  );
  it.each([400, 401, 403, 404])(
    'never retries deterministic HTTP %s',
    (upstreamStatus) => {
      expect(
        transientRetryDelay({ ...failure, upstreamStatus }, options),
      ).toBeUndefined();
    },
  );
  it('does not retry schema/adapter/execution failures or consume the final call needed by generation', () => {
    expect(
      transientRetryDelay(
        {
          ...failure,
          origin: 'provider_response',
          category: 'structured_output',
        },
        options,
      ),
    ).toBeUndefined();
    expect(
      transientRetryDelay({ ...failure, origin: 'execution' }, options),
    ).toBeUndefined();
    expect(
      transientRetryDelay(failure, { ...options, calls: 2, reserveCalls: 1 }),
    ).toBeUndefined();
    expect(
      transientRetryDelay(failure, { ...options, calls: 3 }),
    ).toBeUndefined();
    expect(
      transientRetryDelay(failure, { ...options, deadlineAt: 2499 }),
    ).toBeUndefined();
    expect(
      transientRetryDelay(failure, { ...options, attempt: 2 }),
    ).toBeUndefined();
  });
  it('allows a timed-out model attempt to retry only while the overall deadline permits', () => {
    const timeout: CallFailure = {
      code: 'AI_TIMEOUT',
      category: 'timeout',
      origin: 'transport',
      retryable: true,
    };
    expect(transientRetryDelay(timeout, options)).toBe(500);
    expect(
      transientRetryDelay(timeout, { ...options, deadlineAt: 1000 }),
    ).toBeUndefined();
  });
});
