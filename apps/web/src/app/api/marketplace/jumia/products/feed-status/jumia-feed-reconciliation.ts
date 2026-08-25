import type { SupabaseClient } from '@supabase/supabase-js';
import type { PendingFeedMapping } from '@/lib/jumia/jumia-feed-reconciliation-batch';
import { logger } from '@/lib/logger';

async function markMappingsAsFeedError(
  supabase: SupabaseClient,
  merchantId: string,
  mappings: PendingFeedMapping[],
  message: string
): Promise<number> {
  let marked = 0;
  for (const mapping of mappings) {
    const { error } = await supabase
      .from('jumia_product_mappings')
      .update({
        sync_status: 'error',
        sync_error: message,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', mapping.id)
      .eq('merchant_id', merchantId);
    if (!error) {
      marked++;
      continue;
    }
    logger.error({
      message: 'Failed to mark rejected Jumia feed mapping',
      error,
      mapping_id: mapping.id,
    });
    throw new Error('Failed to mark rejected Jumia feed mapping');
  }
  return marked;
}

function findMappingForFeedItem(
  mappingsForFeed: PendingFeedMapping[],
  sellerSku: string,
  feedItemCount: number
): PendingFeedMapping | undefined {
  const exactMatch = mappingsForFeed.find(
    (mapping) => mapping.jumia_seller_sku === sellerSku
  );
  if (exactMatch) return exactMatch;

  if (
    feedItemCount === 1 &&
    mappingsForFeed.length === 1 &&
    !mappingsForFeed[0]?.jumia_seller_sku
  ) {
    return mappingsForFeed[0];
  }

  return undefined;
}

export const jumiaFeedReconciliation = {
  findMappingForFeedItem,
  markMappingsAsFeedError,
};
