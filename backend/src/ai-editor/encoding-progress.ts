/** FFmpeg out_time_ms is historically microseconds, despite its name. */
export function encodingProgress(
  line: string,
  duration: number,
): number | undefined {
  if (!Number.isFinite(duration) || duration <= 0) return;
  const numeric = /^(out_time_us|out_time_ms)=(-?\d+(?:\.\d+)?)$/.exec(
    line.trim(),
  );
  const timestamp = /^out_time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(
    line.trim(),
  );
  let seconds: number;
  if (numeric) seconds = Number(numeric[2]) / 1e6;
  else if (timestamp && Number(timestamp[2]) < 60 && Number(timestamp[3]) < 60)
    seconds =
      Number(timestamp[1]) * 3600 +
      Number(timestamp[2]) * 60 +
      Number(timestamp[3]);
  else return;
  if (!Number.isFinite(seconds) || seconds < 0) return;
  // 100 is reserved for a verified, published preview.
  return Math.min(99, Math.max(0, Math.floor((seconds / duration) * 100)));
}
