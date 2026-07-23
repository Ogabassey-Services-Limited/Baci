const MAX_PAST_AGE_MS = 24 * 60 * 60 * 1_000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;

export function isEventTimestampWithinWindow(
  timestamp: string | number,
  now = Date.now()
): boolean {
  const milliseconds =
    typeof timestamp === 'number' ? timestamp * 1_000 : Date.parse(timestamp);
  return (
    Number.isFinite(milliseconds) &&
    milliseconds >= now - MAX_PAST_AGE_MS &&
    milliseconds <= now + MAX_FUTURE_SKEW_MS
  );
}
