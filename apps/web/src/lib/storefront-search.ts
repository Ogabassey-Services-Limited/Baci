import {
  extractProductSearchIds,
  getProductSearchTotalCount,
} from '@baci/shared';
import { cookies } from 'next/headers';
import { STOREFRONT_PRODUCTS_COMPACT_SELECT } from '@/app/api/storefront/products/product-response';
import { logger } from './logger';
import { type NormalizedProduct, normalizeProduct } from './normalize-product';
import { isValidUuid, sanitizeSearchQuery } from './sanitize-core';
import { createPublicClient } from './supabase/public';
import { createClient } from './supabase/server';

export class InvalidMerchantIdError extends Error {
  constructor() {
    super('Invalid merchant_id format');
    this.name = 'InvalidMerchantIdError';
  }
}

interface SearchStorefrontProductsArgs {
  supabase: {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => PromiseLike<{
      data: unknown;
      error: { message: string } | null;
    }>;
    from: (table: string) => {
      insert: (
        value: Record<string, unknown>
      ) => PromiseLike<{ error: unknown }>;
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

export interface StorefrontSearchProductsPage extends StorefrontSearchResult {
  products: NormalizedProduct[];
}

export async function searchStorefrontProducts({
  supabase,
  merchantId,
  query,
  limit,
}: SearchStorefrontProductsArgs): Promise<StorefrontSearchResult> {
  if (!isValidUuid(merchantId)) {
    throw new InvalidMerchantIdError();
  }

  const sanitizedQuery = sanitizeSearchQuery(query);

  const { data: rankedResultsRaw, error } = await supabase.rpc(
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

  const rankedResults = Array.isArray(rankedResultsRaw) ? rankedResultsRaw : [];
  const productIds = extractProductSearchIds(rankedResults);
  const count = getProductSearchTotalCount(rankedResults);

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

export async function getStorefrontSearchProducts(args: {
  merchantId: string;
  query: string;
  limit: number;
}): Promise<StorefrontSearchProductsPage> {
  const publicSupabase = createPublicClient({
    clientInfo: 'baci-storefront-search-page',
  });
  const serverSupabase = createClient(await cookies());

  const searchResult = await searchStorefrontProducts({
    supabase: serverSupabase,
    merchantId: args.merchantId,
    query: args.query,
    limit: args.limit,
  });

  if (searchResult.productIds.length === 0) {
    return {
      ...searchResult,
      products: [],
    };
  }

  const { data, error } = await publicSupabase
    .from('products')
    .select(STOREFRONT_PRODUCTS_COMPACT_SELECT)
    .in('id', searchResult.productIds)
    .eq('merchant_id', args.merchantId)
    .eq('status', 'active');

  if (error) {
    throw error;
  }

  const mapped = (data ?? []).map((row) => normalizeProduct(row as never));
  const order = new Map(
    searchResult.productIds.map((id, index) => [id, index] as const)
  );

  mapped.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return {
    ...searchResult,
    products: mapped,
  };
}
