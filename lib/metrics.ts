export type WindowMetrics = {
  currentAvg: number | null;
  previousAvg: number | null;
  delta: number | null;
  currentCount: number;
  previousCount: number;
};

export function getWindowMetrics(scores: number[], windowSize: number): WindowMetrics {
  if (windowSize <= 0) {
    return {
      currentAvg: null,
      previousAvg: null,
      delta: null,
      currentCount: 0,
      previousCount: 0,
    };
  }
  const currentSlice = scores.slice(0, windowSize);
  const previousSlice = scores.slice(windowSize, windowSize * 2);

  const avg = (vals: number[]) =>
    vals.reduce((sum, v) => sum + v, 0) / (vals.length || 1);

  const currentAvg = currentSlice.length > 0 ? avg(currentSlice) : null;
  const previousAvg = previousSlice.length === windowSize ? avg(previousSlice) : null;
  const delta =
    currentAvg !== null && previousAvg !== null ? currentAvg - previousAvg : null;

  return {
    currentAvg,
    previousAvg,
    delta,
    currentCount: currentSlice.length,
    previousCount: previousSlice.length,
  };
}
