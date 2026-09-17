export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatDuration(startTime: number, endTime: number): string {
  const dur = Math.max(0, Math.round(endTime - startTime));
  return `${dur}s`;
}