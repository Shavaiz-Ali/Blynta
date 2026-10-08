export interface PricingSnapshot {
  version: string;
  sourceSeconds: number;
  outputSeconds: number;
  studioSeconds: number;
  studioModifier: number;
  aiCredits: number;
}

export const INITIAL_PRICING: PricingSnapshot = Object.freeze({
  version: '2026-10-v1',
  sourceSeconds: 300,
  outputSeconds: 60,
  studioSeconds: 60,
  studioModifier: 1,
  aiCredits: 1,
});

export function units(seconds: number, interval: number): number {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0 ||
    !Number.isFinite(interval) ||
    interval <= 0
  )
    throw new Error('Invalid billing duration or rate');
  const result = Math.ceil(seconds / interval);
  if (!Number.isSafeInteger(result))
    throw new Error('Credit amount exceeds safe range');
  return result;
}

export function clipPrice(
  source: number,
  output: number,
  pricing = INITIAL_PRICING,
) {
  const sourceCredits = units(source, pricing.sourceSeconds);
  const renderCredits = units(output, pricing.outputSeconds);
  return {
    sourceCredits,
    renderCredits,
    totalCredits: sourceCredits + renderCredits,
  };
}

export function studioPrice(duration: number, pricing = INITIAL_PRICING) {
  return Math.ceil(
    units(duration, pricing.studioSeconds) * pricing.studioModifier,
  );
}

/** Source analysis is charged once, only when at least one output is delivered. */
export function eligibleClipPrice(
  source: number,
  deliveredSeconds: number,
  pricing: PricingSnapshot,
) {
  return deliveredSeconds > 0
    ? clipPrice(source, deliveredSeconds, pricing).totalCredits
    : 0;
}
