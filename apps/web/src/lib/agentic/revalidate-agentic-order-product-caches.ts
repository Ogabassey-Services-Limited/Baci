import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { productCacheRevalidation } from '@/lib/product-cache-revalidation';
import { sanitizeForLog } from '@/lib/sanitize-core';
import { scheduleOrderProductBlogPurgeAfterResponse } from '@/lib/schedule-order-product-blog-purge-after-response';

interface ProductCacheRow {
  id: string;
  manage_stock: boolean | null;
  slug: string;
}

interface RevalidateAgenticOrderProductCachesInput {
  merchantId: string;
  productIds: readonly (string | null | undefined)[];
  sessionId: string;
  slugLookupFailureMessage: string;
  outerFailureMessage: string;
  supabase: SupabaseClient;
}

/** Revalidates sold-product caches while keeping article enrichment post-response. */
export async function revalidateAgenticOrderProductCaches({
  merchantId,
  productIds,
  sessionId,
  slugLookupFailureMessage,
  outerFailureMessage,
  supabase,
}: RevalidateAgenticOrderProductCachesInput): Promise<void> {
  try {
    const normalizedProductIds = Array.from(
      new Set(
        productIds
          .filter(
            (id): id is string => typeof id === 'string' && id.trim().length > 0
          )
          .map((id) => id.trim())
      )
    );
    if (normalizedProductIds.length === 0) {
      return;
    }

    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, slug, manage_stock')
        .in('id', normalizedProductIds)
        .eq('merchant_id', merchantId)
        .returns<ProductCacheRow[]>();

      if (error) {
        productCacheRevalidation.revalidateProducts(merchantId, undefined, {
          feedScope: 'merchant',
        });
        logger.error({
          error: sanitizeForLog(error),
          message: slugLookupFailureMessage,
          sessionId: sanitizeForLog(sessionId),
        });
        return;
      }

      const trackedProducts = (products ?? []).filter(
        (product) => product.manage_stock === true
      );
      if (trackedProducts.length > 0) {
        // Article rails change only when inventory-tracked products mutate.
        // Unlimited-stock sales still refresh dashboard state, but do not
        // enqueue an unnecessary relationship lookup and CDN purge.
        scheduleOrderProductBlogPurgeAfterResponse({
          merchantId,
          productIds: trackedProducts.map((product) => product.id),
          supabase,
        });
        productCacheRevalidation.revalidateProducts(merchantId, undefined, {
          feedScope: 'merchant',
        });
        productCacheRevalidation.revalidateProductSlugs(
          merchantId,
          trackedProducts.map((product) => product.slug)
        );
      } else {
        productCacheRevalidation.revalidateDashboard(merchantId);
      }
    } catch (error) {
      logger.error({
        error: sanitizeForLog(error),
        message: slugLookupFailureMessage,
        sessionId: sanitizeForLog(sessionId),
      });
    }
  } catch (error) {
    logger.error({
      error: sanitizeForLog(error),
      message: outerFailureMessage,
      sessionId: sanitizeForLog(sessionId),
    });
  }
}
