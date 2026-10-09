import { UnrecoverableError } from 'bullmq';
import { clipPrice, units } from './credit-pricing';
import type { CreditOperation } from './credit.schemas';

export const SOURCE_AUTHORIZATION_REQUIRED =
  'SOURCE_DURATION_AUTHORIZATION_REQUIRED';

export class SourceAuthorizationError extends UnrecoverableError {
  constructor(
    readonly approvedSeconds: number,
    readonly measuredSeconds: number,
  ) {
    super(
      `${SOURCE_AUTHORIZATION_REQUIRED}: The downloaded video exceeds its approved source budget. Review a new estimate and explicitly approve it before starting again.`,
    );
  }
}

export function requiresSourceApproval(message?: string) {
  return (
    !!message &&
    /SOURCE_DURATION_AUTHORIZATION_REQUIRED|Source exceeds approved duration|Source duration is unavailable or exceeds the approved duration limit/.test(
      message,
    )
  );
}

/** Whole-second platform metadata may omit a fractional second. Never add a billing unit. */
export function sourceDurationAuthorized(
  op: Pick<
    CreditOperation,
    'sourceSeconds' | 'maxOutputSeconds' | 'authorized' | 'pricing' | 'product'
  >,
  measured: number,
) {
  if (
    !Number.isFinite(measured) ||
    measured <= 0 ||
    !Number.isFinite(op.sourceSeconds) ||
    op.sourceSeconds <= 0
  )
    return false;
  if (op.product !== 'ai-clips') return measured <= op.sourceSeconds;
  if (measured > 14400) return false;
  const withinPrecision =
    measured <= op.sourceSeconds ||
    (Number.isInteger(op.sourceSeconds) &&
      measured < op.sourceSeconds + 1 &&
      units(measured, op.pricing.sourceSeconds) ===
        units(op.sourceSeconds, op.pricing.sourceSeconds));
  return (
    withinPrecision &&
    clipPrice(measured, op.maxOutputSeconds, op.pricing).totalCredits <=
      op.authorized
  );
}
