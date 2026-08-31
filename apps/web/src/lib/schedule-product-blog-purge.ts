import type { SupabaseClient } from '@supabase/supabase-js';
import { expireProductBlogCache } from '@/lib/expire-product-blog-cache';
import { getPublishedBlogPostSlugsForProducts } from '@/lib/get-published-blog-post-slugs-for-products';
import { scheduleStorefrontProductPurge } from '@/lib/storefront-product-purge';
import type { StorefrontProductPurgeEntry } from '@/lib/storefront-product-purge-urls';

export interface ScheduleProductBlogPurgeInput {
  supabase: SupabaseClient;
  merchantId: string;
  merchantSlug?: string | null;
  productIds: readonly string[];
  entries: readonly StorefrontProductPurgeEntry[];
  categorySlugs?: readonly (string | null | undefined)[];
  /** Pass pre-delete results because the relationship rows may have cascaded. */
  blogPostSlugs?: readonly string[];
  /** Keep the immediate product purge, but skip a second purge when no blog is linked. */
  skipWhenNoLinkedPosts?: boolean;
}

function normalizeBlogPostSlugs(slugs: readonly string[]) {
  return Array.from(
    new Set(
      slugs
        .map((slug) => slug.trim().toLowerCase())
        .filter((slug) => slug.length > 0)
    )
  );
}

/**
 * Resolve and schedule the published article URLs affected by a product
 * mutation. This is best-effort cache invalidation: lookup or scheduling
 * failures are logged and never escape into the product mutation response.
 * Delete callers can provide a pre-delete slug snapshot because the join rows
 * are removed by the product mutation's cascade.
 */
export async function scheduleProductBlogPurge({
  supabase,
  merchantId,
  merchantSlug,
  productIds,
  entries,
  categorySlugs,
  blogPostSlugs,
  skipWhenNoLinkedPosts = false,
}: ScheduleProductBlogPurgeInput): Promise<void> {
  try {
    const normalizedMerchantSlug = merchantSlug?.trim();
    if (!normalizedMerchantSlug || entries.length === 0) {
      return;
    }

    // Invalidate the Next data before the outer CDN purge can trigger a refill.
    expireProductBlogCache(merchantId);

    const linkedSlugs = normalizeBlogPostSlugs(
      blogPostSlugs === undefined
        ? await getPublishedBlogPostSlugsForProducts(
            supabase,
            merchantId,
            productIds,
            (categorySlugs ?? []).filter(
              (categorySlug): categorySlug is string =>
                typeof categorySlug === 'string' &&
                categorySlug.trim().length > 0
            )
          )
        : blogPostSlugs
    );

    if (linkedSlugs.length > 0) {
      scheduleStorefrontProductPurge(normalizedMerchantSlug, entries, {
        blogPostSlugs: linkedSlugs,
      });
    } else if (!skipWhenNoLinkedPosts) {
      scheduleStorefrontProductPurge(normalizedMerchantSlug, entries);
    }
  } catch (error) {
    console.warn('Skipped product blog purge scheduling', {
      merchantId,
      productCount: productIds.length,
      error,
    });
  }
}
