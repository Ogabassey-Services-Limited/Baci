const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ANALYTICS_RANGE_DAYS = 366;

interface ComparisonAnalyticsRange {
  previousEnd: Date;
  previousStart: Date;
}

export function getComparisonAnalyticsRange(
  startDate: Date,
  endDate: Date
): ComparisonAnalyticsRange {
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid analytics date range');
  }

  const requestedRangeMs = endDate.getTime() - startDate.getTime();
  if (requestedRangeMs < 0) {
    throw new Error('Analytics start date must be on or before the end date');
  }

  const maxRangeMs = MAX_ANALYTICS_RANGE_DAYS * DAY_MS;
  if (requestedRangeMs > maxRangeMs) {
    throw new Error(
      `Analytics date range cannot exceed ${MAX_ANALYTICS_RANGE_DAYS} days`
    );
  }

  const previousEnd = new Date(startDate.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - requestedRangeMs);

  return {
    previousEnd,
    previousStart,
  };
}
