import type { SupabaseClient } from '@supabase/supabase-js';
import { expireProductBlogCache } from '@/lib/expire-product-blog-cache';
import type { Database } from '@/types/supabase';

const QUIZ_CACHE_TARGET_BATCH_LIMIT = 1000;

type QuizClient = SupabaseClient<Database>;

interface QuizEventCacheRow {
  merchant_id?: unknown;
  settings?: unknown;
}

interface QuizAwardCacheRow {
  event_id?: unknown;
  product_id?: unknown;
}

function hasProductPrize(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return false;
  }
  const productId = (settings as Record<string, unknown>).prize_product_id;
  return typeof productId === 'string' && productId.trim().length > 0;
}

function addMerchantId(targets: Set<string>, value: unknown) {
  if (typeof value === 'string' && value.trim().length > 0) {
    targets.add(value.trim());
  }
}

/**
 * Expire product/blog cache tags for quiz prize mutations observed by the
 * worker. Quiz RPCs mutate reservation rows inside the database, so this
 * small post-RPC sweep keeps the cached enrichment from serving the previous
 * availability snapshot while the durable outbox catches up.
 */
export async function invalidateQuizProductCaches(
  client: QuizClient,
  changedAfter: string
): Promise<void> {
  if (typeof (client as { from?: unknown }).from !== 'function') return;

  const merchantIds = new Set<string>();

  try {
    const eventResult = await client
      .from('quiz_events')
      .select('merchant_id, settings')
      .gte('updated_at', changedAfter)
      .limit(QUIZ_CACHE_TARGET_BATCH_LIMIT);
    if (!eventResult.error) {
      for (const row of (eventResult.data ?? []) as QuizEventCacheRow[]) {
        if (hasProductPrize(row.settings)) {
          addMerchantId(merchantIds, row.merchant_id);
        }
      }
    }
  } catch {
    // The quiz RPC already completed; cache expiry remains best effort.
  }

  let awardRows: QuizAwardCacheRow[] = [];
  try {
    const awardResult = await client
      .from('quiz_awards')
      .select('event_id, product_id')
      .not('expired_at', 'is', null)
      .gte('expired_at', changedAfter)
      .limit(QUIZ_CACHE_TARGET_BATCH_LIMIT);
    if (!awardResult.error) {
      awardRows = (awardResult.data ?? []) as QuizAwardCacheRow[];
    }
  } catch {
    // The quiz RPC already completed; cache expiry remains best effort.
  }
  const expiredEventIds = Array.from(
    new Set(
      awardRows
        .map((row) => row.event_id)
        .filter((eventId): eventId is string => typeof eventId === 'string')
    )
  );
  if (expiredEventIds.length > 0) {
    try {
      const expiredEventResult = await client
        .from('quiz_events')
        .select('merchant_id')
        .in('id', expiredEventIds);
      if (!expiredEventResult.error) {
        for (const row of (expiredEventResult.data ??
          []) as QuizEventCacheRow[]) {
          addMerchantId(merchantIds, row.merchant_id);
        }
      }
    } catch {
      // The quiz RPC already completed; cache expiry remains best effort.
    }
  }

  for (const merchantId of merchantIds) {
    expireProductBlogCache(merchantId);
  }
}
