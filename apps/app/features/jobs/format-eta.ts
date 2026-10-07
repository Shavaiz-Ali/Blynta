/** Format an API estimate in seconds without inventing or decrementing time. */
export function formatRemainingTime(seconds: unknown): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }
  const roundedSeconds = Math.ceil(seconds);
  if (roundedSeconds < 60) return "~" + roundedSeconds + " sec remaining";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return "~" + minutes + " min remaining";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return (
    "~" +
    hours +
    " hr" +
    (remainder ? " " + remainder + " min" : "") +
    " remaining"
  );
}
