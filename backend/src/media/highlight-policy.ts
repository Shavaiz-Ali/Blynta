/** Backend-owned clip targets. Budget enough for whole clips, never trim to fit. */
export function highlightPolicy(
  plan: string | undefined,
  sourceSeconds: number,
) {
  const max = plan === 'pro' || plan === 'business' ? 9 : 6;
  return { min: 0, max, outputSeconds: Math.min(sourceSeconds, max * 60) };
}
