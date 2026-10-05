export function formatTimestamp(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${pad(h)}:${pad(rm)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}
