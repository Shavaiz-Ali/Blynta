export function formatTime(seconds: number) {
  const value = Math.round(Math.max(0, seconds) * 100);
  return `${String(Math.floor(value / 6000)).padStart(2, "0")}:${String(Math.floor(value / 100) % 60).padStart(2, "0")}.${String(value % 100).padStart(2, "0")}`;
}
