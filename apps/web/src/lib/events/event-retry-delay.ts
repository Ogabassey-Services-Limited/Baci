const RETRY_DELAYS_SECONDS = [
  30, 120, 600, 1_800, 7_200, 21_600, 43_200, 86_400,
];

export function getEventRetryDelaySeconds(
  attempt: number,
  random: () => number = Math.random
): number {
  const index = Math.min(
    Math.max(attempt - 1, 0),
    RETRY_DELAYS_SECONDS.length - 1
  );
  const base = RETRY_DELAYS_SECONDS[index] ?? RETRY_DELAYS_SECONDS[0];
  const jitter = 0.8 + Math.min(Math.max(random(), 0), 1) * 0.4;
  return Math.max(1, Math.round(base * jitter));
}
