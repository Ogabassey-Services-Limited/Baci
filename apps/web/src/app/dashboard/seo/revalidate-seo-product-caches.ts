import type { SupabaseClient } from '@supabase/supabase-js';
import {
  revalidateProductSlugs,
  revalidateProducts,
} from '@/lib/cache-revalidation';
import { scheduleStorefrontProductPurge } from '@/lib/storefront-product-purge';
import {
  type ProductPurgeCategoryRow,
  resolveProductPurgeCategorySegmentForRow,
  type StorefrontProductPurgeEntry,
} from '@/lib/storefront-product-purge-urls';

/**
 * Refresh the public product caches affected by fulfilled SEO writes.
 *
 * Cache invalidation is intentionally fail-open: persistence has already
 * succeeded when this runs, and a cache outage must not change the server
 * action's result. Only rows still active are included, so draft/archived SEO
 * edits never issue Cloudflare purges.
 */
export async function revalidateSeoProductCaches(
  supabase: SupabaseClient,
  merchantId: string,
  productIds: readonly string[]
): Promise<void> {
  const fulfilledProductIds = Array.from(
    new Set(
      productIds
        .map((productId) => productId.trim())
        .filter((productId) => productId.length > 0)
    )
  );
  if (fulfilledProductIds.length === 0) {
    return;
  }

  try {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(
        'id, slug, name, category, categories:category_id(slug), product_categories(categories(slug))'
      )
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .in('id', fulfilledProductIds);

    if (productsError) {
      console.warn(
        'Skipped SEO product cache refresh after row lookup failed',
        {
          productsError,
        }
      );
      return;
    }

    const publicPurgeEntries: StorefrontProductPurgeEntry[] = [];
    for (const product of products ?? []) {
      const productRow = product as ProductPurgeCategoryRow;
      const purgeSlug = productRow.slug?.trim() || productRow.id?.trim();
      if (!purgeSlug) {
        continue;
      }
      publicPurgeEntries.push({
        slug: purgeSlug,
        categorySegment: resolveProductPurgeCategorySegmentForRow(productRow),
      });
    }

    if (publicPurgeEntries.length === 0) {
      return;
    }

    revalidateProducts(merchantId);
    revalidateProductSlugs(
      merchantId,
      publicPurgeEntries.map((entry) => entry.slug)
    );

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('slug')
      .eq('id', merchantId)
      .maybeSingle();
    if (merchantError) {
      console.warn('Skipped SEO merchant slug lookup for product purge', {
        merchantError,
      });
    }

    scheduleStorefrontProductPurge(merchant?.slug, publicPurgeEntries);
  } catch (cacheError) {
    console.warn('Skipped SEO product cache refresh', { cacheError });
  }
}
