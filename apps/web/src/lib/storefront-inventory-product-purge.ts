import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { scheduleStorefrontProductPurge } from '@/lib/storefront-product-purge';
import {
  type ProductPurgeCategoryRow,
  resolveProductPurgeCategorySegmentForRow,
} from '@/lib/storefront-product-purge-urls';

interface ScheduleStorefrontInventoryProductPurgeInput {
  merchantId: string;
  merchantSlug?: string | null;
  operation: string;
  products: readonly ProductPurgeCategoryRow[];
  supabase: SupabaseClient;
}

/**
 * Schedules the edge-cache eviction that must follow a stock-changing order
 * mutation. The callers already own Next tag invalidation; this helper only
 * resolves the server-owned storefront slug and schedules the bounded
 * Cloudflare product/hostname purge. Cache failures are intentionally
 * contained so checkout, cancellation, and payment reconciliation remain
 * correct even when cache infrastructure is unavailable.
 */
export async function scheduleStorefrontInventoryProductPurge({
  merchantId,
  merchantSlug: suppliedMerchantSlug,
  operation,
  products,
  supabase,
}: ScheduleStorefrontInventoryProductPurgeInput): Promise<void> {
  const entries = products.flatMap((product) => {
    const slug = product.slug?.trim() || product.id?.trim();
    if (!slug) {
      return [];
    }
    return [
      {
        categorySegment: resolveProductPurgeCategorySegmentForRow(product),
        slug,
      },
    ];
  });
  if (entries.length === 0) {
    return;
  }

  try {
    let merchantSlug = suppliedMerchantSlug?.trim();
    if (!merchantSlug) {
      const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('slug')
        .eq('id', merchantId)
        .maybeSingle();
      if (merchantError) {
        throw merchantError;
      }
      merchantSlug = merchant?.slug?.trim();
    }
    if (!merchantSlug) {
      return;
    }
    scheduleStorefrontProductPurge(merchantSlug, entries);
  } catch (error) {
    logger.error({
      error,
      merchantId,
      message: 'Failed to schedule storefront inventory cache purge',
      operation,
    });
  }
}
