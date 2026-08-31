import { productCacheRevalidation } from '@/lib/product-cache-revalidation';

/**
 * Hard-expire product and related-blog cache entries before an edge purge.
 * Article enrichment embeds product availability, so stale-while-revalidate
 * could otherwise refill a purged document with the pre-mutation snapshot.
 */
export function expireProductBlogCache(merchantId: string): void {
  productCacheRevalidation.revalidateProducts(merchantId, undefined, {
    expireImmediately: true,
    feedScope: 'none',
  });
}
