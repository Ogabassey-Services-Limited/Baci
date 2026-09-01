import { revalidateTag } from 'next/cache';
import { normalizeMerchantId } from '@/lib/normalize-merchant-id';

/**
 * Hard-expire product and related-blog cache entries before an edge purge.
 * Article enrichment embeds product availability, so stale-while-revalidate
 * could otherwise refill a purged document with the pre-mutation snapshot.
 */
export function expireProductBlogCache(merchantId: string): void {
  const normalizedMerchantId = normalizeMerchantId(merchantId);
  if (!normalizedMerchantId) return;

  // Blog enrichment is keyed by the merchant's product tag, while the
  // route-critical blog core carries the merchant identity (and currency)
  // tag. Avoid the broad product revalidation helper here: that helper also
  // expires storefront indexes, redirects, feeds, and dashboard caches.
  for (const tag of [
    `products-${normalizedMerchantId}`,
    `merchant-id-${normalizedMerchantId}`,
  ]) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      // Cache invalidation is best effort; callers still enqueue the durable
      // edge purge and the normal cache TTL provides a recovery path.
    }
  }
}
