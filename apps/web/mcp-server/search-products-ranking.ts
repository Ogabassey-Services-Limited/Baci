import { normalizeCanonicalProductCondition } from '@baci/shared/lib';

const POST_FILTER_RESULT_BUFFER = 100;

interface McpSearchProductsArgs {
  brand?: string;
  category?: string;
  condition?: 'new' | 'used' | 'open_box' | 'refurbished' | string;
  max_price?: number;
  min_price?: number;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'relevance';
}

export function buildSearchProductsV2RpcArgs({
  args,
  limit,
  merchantId,
  sanitizedQuery,
}: {
  args: McpSearchProductsArgs;
  limit: number;
  merchantId: string;
  sanitizedQuery: string;
}) {
  const conditionFilter =
    normalizeCanonicalProductCondition(args.condition) || null;

  return {
    brand_filter: null,
    category_id_filter: null,
    condition_filter: conditionFilter,
    max_price_filter: args.max_price ?? null,
    merchant_id_param: merchantId,
    min_price_filter: args.min_price ?? null,
    min_rating_filter: null,
    parent_only: false,
    result_limit: args.brand || args.category ? POST_FILTER_RESULT_BUFFER : limit,
    result_offset: 0,
    search_query: sanitizedQuery,
    sort_by: args.sort ?? 'relevance',
    status_filter: 'active',
    stock_filter: null,
  };
}

export function orderRowsByRankedProductIds<T extends { id: string }>(
  rows: T[],
  rankedProductIds: string[]
) {
  const order = new Map(
    rankedProductIds.map((id, index) => [id, index] as const)
  );

  return [...rows].sort(
    (a, b) =>
      (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  );
}
