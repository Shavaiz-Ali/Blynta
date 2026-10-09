import { Job as BullJob, UnrecoverableError } from 'bullmq';
import { INITIAL_PRICING } from './credit-pricing';
import {
  sourceDurationAuthorized,
  SourceAuthorizationError,
} from './source-authorization';

describe('immutable source duration authorization', () => {
  const op = {
    product: 'ai-clips' as const,
    sourceSeconds: 3233,
    maxOutputSeconds: 540,
    authorized: 20,
    pricing: INITIAL_PRICING,
  };
  it.each([3233, 3233.461, 3233.999, 3232.5])(
    'accepts %s without changing the approved price',
    (duration) => {
      expect(sourceDurationAuthorized(op, duration)).toBe(true);
    },
  );
  it.each([3234, 3234.001, 3400, 0, -1, NaN, Infinity, 14400.001])(
    'rejects %s',
    (duration) => {
      expect(sourceDurationAuthorized(op, duration)).toBe(false);
    },
  );
  it('does not allow rounding to add a source credit or consume unused output allowance', () => {
    expect(
      sourceDurationAuthorized(
        { ...op, sourceSeconds: 300, authorized: 11 },
        300.001,
      ),
    ).toBe(false);
    expect(sourceDurationAuthorized({ ...op, authorized: 19 }, 3233.461)).toBe(
      false,
    );
    expect(
      sourceDurationAuthorized(
        { ...op, pricing: { ...INITIAL_PRICING, sourceSeconds: 3233 } },
        3233.001,
      ),
    ).toBe(false);
  });
  it('uses precision tolerance only for whole-second clip metadata; studio remains strict', () => {
    expect(
      sourceDurationAuthorized({ ...op, sourceSeconds: 3233.25 }, 3233.461),
    ).toBe(false);
    expect(
      sourceDurationAuthorized({ ...op, product: 'studio' }, 3233.461),
    ).toBe(false);
    expect(sourceDurationAuthorized({ ...op, product: 'studio' }, 3233)).toBe(
      true,
    );
  });
  it('uses the installed BullMQ retry decision to stop authorization errors on the first attempt', async () => {
    const decision = (
      BullJob.prototype as unknown as {
        shouldRetryJob: (error: Error) => Promise<[boolean, number]>;
      }
    ).shouldRetryJob;
    const queueJob = {
      attemptsMade: 0,
      discarded: false,
      opts: { attempts: 3, backoff: { type: 'fixed', delay: 1000 } },
      queue: { opts: {} },
    };
    const error = new SourceAuthorizationError(300, 300.1);
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(await decision.call(queueJob, error)).toEqual([false, 0]);
    expect(
      await decision.call(queueJob, new Error('temporary network failure')),
    ).toEqual([true, 1000]);
  });
});
