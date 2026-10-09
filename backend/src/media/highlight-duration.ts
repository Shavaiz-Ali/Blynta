/** Remove binary subtraction noise without changing timestamp precision. */
export function highlightDurationSeconds(highlight: {
  startTime: number;
  endTime: number;
}): number {
  return Number((highlight.endTime - highlight.startTime).toFixed(9));
}
