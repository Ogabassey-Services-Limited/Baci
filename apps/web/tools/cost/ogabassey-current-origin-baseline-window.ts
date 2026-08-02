const DEFAULT_MAXIMUM_BASELINE_AGE_DAYS = 7;

export function maximumBaselineAgeDays(requested?: number) {
  if (requested === undefined) return DEFAULT_MAXIMUM_BASELINE_AGE_DAYS;
  return Number.isFinite(requested)
    ? Math.min(requested, DEFAULT_MAXIMUM_BASELINE_AGE_DAYS)
    : requested;
}
