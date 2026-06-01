import type { SupabaseClient } from '@supabase/supabase-js';
import { createAnonClient } from '@/lib/supabase/anon';

const FEED_HEALTH_PRODUCTS_PAGE_SIZE = 1000;
const MAX_FEED_HEALTH_PRODUCTS = 10_000;
const FEED_HEALTH_PRODUCTS_SELECT = 'id, created_at, updated_at';

export interface AgentCommerceFeedHealthProduct {
  created_at?: string | null;
  id: string;
  updated_at?: string | null;
}

export interface AgentCommerceFeedHealthSnapshot {
  googleProducts: AgentCommerceFeedHealthProduct[];
  openAiProducts: AgentCommerceFeedHealthProduct[];
}

interface AgentCommerceFeedHealthSnapshotInput {
  merchantId: string;
  supabase?: SupabaseClient;
}

interface FeedHealthProductCursor {
  createdAt: string;
  id: string;
}

function quotePostgrestFilterValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function getFeedHealthProductCursor(
  page: AgentCommerceFeedHealthProduct[]
): FeedHealthProductCursor | null {
  for (let index = page.length - 1; index >= 0; index -= 1) {
    const row = page[index];
    if (row?.created_at) {
      return {
        createdAt: row.created_at,
        id: row.id,
      };
    }
  }

  return null;
}

async function fetchActiveFeedHealthProducts(
  supabase: SupabaseClient,
  merchantId: string
): Promise<AgentCommerceFeedHealthProduct[]> {
  const products: AgentCommerceFeedHealthProduct[] = [];
  let cursor: FeedHealthProductCursor | null = null;
  let readNullCreatedAtRows = false;
  let nullCreatedAtCursorId: string | null = null;

  while (true) {
    // Health cron only needs product IDs and timestamps. Do not call the full
    // feed builders here; they hydrate variants/images/offers and timed out in
    // production while this monitor was running.
    let query = supabase
      .from('products')
      .select(FEED_HEALTH_PRODUCTS_SELECT)
      .eq('merchant_id', merchantId)
      .eq('status', 'active');

    if (readNullCreatedAtRows) {
      query = query.is('created_at', null);

      if (nullCreatedAtCursorId) {
        query = query.gt('id', nullCreatedAtCursorId);
      }
    } else {
      query = query.not('created_at', 'is', null);
    }

    if (!readNullCreatedAtRows && cursor) {
      const quotedCreatedAt = quotePostgrestFilterValue(cursor.createdAt);
      const quotedId = quotePostgrestFilterValue(cursor.id);

      query = query.or(
        `created_at.lt.${quotedCreatedAt},and(created_at.eq.${quotedCreatedAt},id.gt.${quotedId})`
      );
    }

    const { data, error } = await (readNullCreatedAtRows
      ? query
          .order('id', { ascending: true })
          .limit(FEED_HEALTH_PRODUCTS_PAGE_SIZE)
      : query
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .limit(FEED_HEALTH_PRODUCTS_PAGE_SIZE));

    if (error) {
      throw error;
    }

    const page = (data ?? []) as AgentCommerceFeedHealthProduct[];
    const remaining = MAX_FEED_HEALTH_PRODUCTS - products.length;
    products.push(...page.slice(0, remaining));

    if (products.length >= MAX_FEED_HEALTH_PRODUCTS) {
      break;
    }

    if (page.length < FEED_HEALTH_PRODUCTS_PAGE_SIZE) {
      if (!readNullCreatedAtRows) {
        readNullCreatedAtRows = true;
        nullCreatedAtCursorId = null;
        continue;
      }
      break;
    }

    if (readNullCreatedAtRows) {
      const lastNullCreatedAtProduct = page.at(-1);
      if (!lastNullCreatedAtProduct?.id) {
        break;
      }

      nullCreatedAtCursorId = lastNullCreatedAtProduct.id;
      continue;
    }

    const nextCursor = getFeedHealthProductCursor(page);
    if (!nextCursor) {
      break;
    }

    cursor = nextCursor;
  }

  return products;
}

export async function getAgentCommerceFeedHealthSnapshot({
  merchantId,
  supabase = createAnonClient(),
}: AgentCommerceFeedHealthSnapshotInput): Promise<AgentCommerceFeedHealthSnapshot> {
  const activeProducts = await fetchActiveFeedHealthProducts(
    supabase,
    merchantId
  );

  // Both machine-readable feeds derive their product surface from active
  // products. This monitor intentionally checks lightweight coverage/freshness;
  // full feed parity belongs outside the cron path that timed out in production.
  return {
    googleProducts: activeProducts,
    openAiProducts: activeProducts,
  };
}
