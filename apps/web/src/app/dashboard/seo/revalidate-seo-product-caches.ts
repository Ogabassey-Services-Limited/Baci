import type { SupabaseClient } from '@supabase/supabase-js';
import { productCacheRevalidation } from '@/lib/product-cache-revalidation';

/**
 * Refresh the public product caches affected by fulfilled SEO writes.
 *
 * Cache invalidation is intentionally fail-open: persistence has already
 * succeeded when this runs, and a cache outage must not change the server
 * action's result. Only rows still active are included, so draft/archived SEO
 * edits never churn public product caches.
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
      .select('id, slug')
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

    const publicProductSlugs = (products ?? []).flatMap((product) => {
      const productSlug = product.slug?.trim() || product.id?.trim();
      return productSlug ? [productSlug] : [];
    });

    if (publicProductSlugs.length === 0) {
      return;
    }

    productCacheRevalidation.revalidateProducts(merchantId, undefined, {
      feedScope: 'merchant',
    });
    productCacheRevalidation.revalidateProductSlugs(
      merchantId,
      publicProductSlugs
    );
  } catch (cacheError) {
    console.warn('Skipped SEO product cache refresh', { cacheError });
  }
}
