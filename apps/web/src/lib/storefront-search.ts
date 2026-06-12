import {
  extractProductSearchIds,
  getProductSearchTotalCount,
} from '@baci/shared';
import { cookies } from 'next/headers';
import { after } from 'next/server';
import { logger } from './logger';
import { type NormalizedProduct, normalizeProduct } from './normalize-product';
import { isValidUuid, sanitizeSearchQuery } from './sanitize-core';
import { STOREFRONT_PRODUCTS_COMPACT_SELECT } from './storefront-products-select';
import { createPublicClient } from './supabase/public';
import { createClient } from './supabase/server';

export class InvalidMerchantIdError extends Error {
  constructor() {
    super('Invalid merchant_id format');
    this.name = 'InvalidMerchantIdError';
  }
}

interface StorefrontSearchSupabase {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

interface StorefrontSearchAnalyticsSupabase {
  from: (table: string) => {
    insert: (value: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
  };
}

interface SearchStorefrontProductsArgs {
  supabase: StorefrontSearchSupabase;
  analyticsSupabase?: StorefrontSearchAnalyticsSupabase;
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

function isAfterOutsideRequestScopeError(error: unknown) {
  return (
    error instanceof Error && error.message.includes('outside a request scope')
  );
}

function createSearchAnalyticsClient() {
  return createPublicClient({
    clientInfo: 'baci-storefront-search-analytics',
  });
}

function runSearchAnalyticsAfterResponse(callback: () => Promise<void>) {
  try {
    after(callback);
  } catch (error) {
    if (!isAfterOutsideRequestScopeError(error)) {
      throw error;
    }

    // `after()` is available only inside a Next request/render lifecycle. Keep
    // analytics non-blocking for plain unit tests and non-request callers.
    void callback();
  }
}

async function insertSearchAnalytics({
  supabase,
  merchantId,
  query,
  resultsCount,
}: {
  supabase: StorefrontSearchAnalyticsSupabase;
  merchantId: string;
  query: string;
  resultsCount: number;
}) {
  try {
    const { error: analyticsError } = await supabase
      .from('search_analytics')
      .insert({
        merchant_id: merchantId,
        search_query: query,
        results_count: resultsCount,
        search_method: 'server',
      });

    if (analyticsError) {
      logger.warn({
        message: 'Storefront search analytics insert failed',
        error: analyticsError,
        merchantId,
        query,
      });
    }
  } catch (analyticsError) {
    logger.warn({
      message: 'Storefront search analytics insert failed',
      error: analyticsError,
      merchantId,
      query,
    });
  }
}

function scheduleSearchAnalyticsInsert(args: {
  supabase?: StorefrontSearchAnalyticsSupabase;
  merchantId: string;
  query: string;
  resultsCount: number;
}) {
  const supabase = args.supabase ?? createSearchAnalyticsClient();

  runSearchAnalyticsAfterResponse(() =>
    insertSearchAnalytics({
      ...args,
      supabase,
    })
  );
}

export async function searchStorefrontProducts({
  supabase,
  analyticsSupabase,
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

  scheduleSearchAnalyticsInsert({
    supabase: analyticsSupabase,
    merchantId,
    query: sanitizedQuery,
    resultsCount: count,
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
