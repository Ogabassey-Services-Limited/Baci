import type { AnalyticsProperties } from '@baci/shared/contracts';
import {
  type ClassifiedFetchFailure,
  classifyFetchFailure,
} from '@/lib/fetch-failure-classification';
import { trackError } from '@/services/analytics';

/**
 * Classify a fetch failure and report it to analytics with an actionable
 * category. Intentional cancellations (unmount/navigation aborts) are
 * classified but NOT reported — they are lifecycle noise, not production
 * errors. Returns the classification so callers can branch on it (retry,
 * fallback UI, re-auth).
 */
export function trackFetchFailure(
  surface: string,
  error: unknown,
  context?: AnalyticsProperties
): ClassifiedFetchFailure {
  const classified = classifyFetchFailure(error);

  if (classified.isReportable) {
    trackError(surface, classified.message, {
      error_category: classified.category,
      error_retryable: classified.isRetryable,
      ...context,
    });
  }

  return classified;
}
