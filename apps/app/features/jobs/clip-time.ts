/** Use the same whole-second precision for source ranges and their duration. */
export function clipTimeRange(start: number, end: number) {
  const startSeconds = wholeSeconds(start);
  const endSeconds = Math.max(startSeconds, wholeSeconds(end));
  return {
    start: startSeconds,
    end: endSeconds,
    duration: endSeconds - startSeconds,
  };
}

function wholeSeconds(seconds: number) {
  return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
}

export function formatClipTime(seconds: number, padMinutes = true) {
  const value = wholeSeconds(seconds);
  const minutes = String(Math.floor(value / 60));
  return `${padMinutes ? minutes.padStart(2, "0") : minutes}:${String(value % 60).padStart(2, "0")}`;
}
