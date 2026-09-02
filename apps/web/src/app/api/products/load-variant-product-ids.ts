import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidUuid, sanitizeLikePattern } from '@/lib/sanitize-core';

const VARIANT_SEARCH_PAGE_SIZE = 1000;

export async function loadVariantProductIds(
  supabase: SupabaseClient,
  merchantId: string,
  search: string
): Promise<string[]> {
  const productIds = new Set<string>();
  const pattern = `%${sanitizeLikePattern(search)}%`;
  for (let offset = 0; ; offset += VARIANT_SEARCH_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('product_variants')
      .select('product_id')
      .eq('merchant_id', merchantId)
      .ilike('sku', pattern)
      .range(offset, offset + VARIANT_SEARCH_PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Array<{
      product_id?: unknown;
    }>;
    for (const row of rows) {
      if (typeof row.product_id === 'string' && isValidUuid(row.product_id)) {
        productIds.add(row.product_id);
      }
    }
    if (rows.length < VARIANT_SEARCH_PAGE_SIZE) break;
  }
  return [...productIds];
}
