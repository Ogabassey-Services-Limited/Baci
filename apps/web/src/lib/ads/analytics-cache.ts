import 'server-only';

import { cache } from '@/lib/cache';

const ADS_ANALYTICS_CACHE_PREFIX = 'ad-analytics';

/**
 * Evict every date-range snapshot for a merchant after an ads connection
 * changes. The analytics endpoint keys snapshots as
 * `ad-analytics:<merchant>:<start>:<end>`; using the merchant-scoped prefix
 * keeps other merchants' snapshots untouched without including any provider
 * credentials in the cache key or invalidation path.
 */
export function invalidateAdsAnalyticsCache(merchantId: string): void {
  const normalizedMerchantId = merchantId.trim();
  if (!normalizedMerchantId) return;

  cache.deletePattern(
    `${ADS_ANALYTICS_CACHE_PREFIX}:${normalizedMerchantId}:*`
  );
}
