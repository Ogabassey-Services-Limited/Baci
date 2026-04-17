import {
  extractProductSearchIds,
  getProductSearchTotalCount,
} from '@baci/shared';
import { logger } from './logger';
import { isValidUuid, stripHtmlTags } from './sanitize-core';

interface SearchStorefrontProductsArgs {
  supabase: {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{
      data: unknown;
      error: { message: string } | null;
    }>;
    from: (table: string) => {
      insert: (value: Record<string, unknown>) => Promise<{ error: unknown }>;
    };
  };
  merchantId: string;
  query: string;
  limit: number;
}

export interface StorefrontSearchResult {
  count: number;
  didYouMean: string | null;
  productIds: string[];
  query: string;
}

export async function searchStorefrontProducts({
  supabase,
  merchantId,
  query,
  limit,
}: SearchStorefrontProductsArgs): Promise<StorefrontSearchResult> {
  if (!isValidUuid(merchantId)) {
    throw new Error('Invalid merchant_id format');
  }

  const sanitizedQuery = stripHtmlTags(query);

  const { data: rankedResults, error } = await supabase.rpc(
    'search_products_v2',
    {
      brand_filter: null,
      category_id_filter: null,
      condition_filter: null,
      max_price_filter: null,
      merchant_id_param: merchantId,
      min_price_filter: null,
      min_rating_filter: null,
      parent_only: false,
      result_limit: limit,
      result_offset: 0,
      search_query: sanitizedQuery,
      sort_by: 'relevance',
      status_filter: 'active',
      stock_filter: null,
    }
  );

  if (error) {
    throw error;
  }

  const productIds = extractProductSearchIds(rankedResults ?? []);
  const count = getProductSearchTotalCount(rankedResults ?? []);

  void supabase.from('search_analytics').insert({
    merchant_id: merchantId,
    search_query: sanitizedQuery,
    results_count: productIds.length,
    search_method: 'server',
  });

  let didYouMean: string | null = null;

  if (productIds.length === 0) {
    const { data: suggestion, error: suggestionError } = await supabase.rpc(
      'find_product_search_suggestion_v2',
      {
        merchant_id_param: merchantId,
        search_term: sanitizedQuery,
      }
    );

    if (suggestionError) {
      logger.error({
        message: 'Search suggestion lookup failed',
        error: suggestionError.message,
        merchantId,
        query: sanitizedQuery,
      });
      throw suggestionError;
    }

    if (Array.isArray(suggestion) && suggestion.length > 0) {
      didYouMean =
        (suggestion[0] as { suggested_term?: string }).suggested_term ?? null;
    }
  }

  return {
    count,
    didYouMean,
    productIds,
    query: sanitizedQuery,
  };
}
