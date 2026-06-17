import {
  extractProductSearchIds,
  getProductSearchTotalCount,
} from '@baci/shared';
import { cookies } from 'next/headers';
import { after } from 'next/server';
import { logger } from './logger';
import { type NormalizedProduct, normalizeProduct } from './normalize-product';
import { isValidUuid, sanitizeSearchQuery } from './sanitize-core';
import { storefrontProductFilters } from './storefront-product-filters';
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

export type StorefrontSearchSort =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'popular'
  | 'newest';

export type StorefrontSearchStockFilter =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock';

export interface StorefrontSearchFilters {
  brand?: string | null;
  categoryId?: string | null;
  condition?: string | null;
  maxPrice?: number | null;
  minPrice?: number | null;
  minRating?: number | null;
  stock?: StorefrontSearchStockFilter | null;
}

interface SearchStorefrontProductsArgs {
  supabase: StorefrontSearchSupabase;
  analyticsSupabase?: StorefrontSearchAnalyticsSupabase;
  filters?: StorefrontSearchFilters;
  merchantId: string;
  query: string;
  limit: number;
  offset?: number;
  sort?: StorefrontSearchSort;
  trackAnalytics?: boolean;
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

function clampSearchLimit(limit: number) {
  return Math.min(Math.max(Math.trunc(limit || 20), 1), 100);
}

function normalizeSearchOffset(offset?: number) {
  return Math.max(Math.trunc(offset || 0), 0);
}

export function toStorefrontSearchSort(
  sort?: string | null
): StorefrontSearchSort {
  const sortMap: Record<string, StorefrontSearchSort> = {
    newest: 'newest',
    popular: 'popular',
    'price-asc': 'price_asc',
    'price-desc': 'price_desc',
    price_asc: 'price_asc',
    price_desc: 'price_desc',
    relevance: 'relevance',
  };

  return sort ? (sortMap[sort] ?? 'relevance') : 'relevance';
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
  filters,
  merchantId,
  query,
  limit,
  offset,
  sort = 'relevance',
  trackAnalytics = true,
}: SearchStorefrontProductsArgs): Promise<StorefrontSearchResult> {
  if (!isValidUuid(merchantId)) {
    throw new InvalidMerchantIdError();
  }

  const sanitizedQuery = sanitizeSearchQuery(query);
  const safeLimit = clampSearchLimit(limit);
  const safeOffset = normalizeSearchOffset(offset);

  const { data: rankedResultsRaw, error } = await supabase.rpc(
    'search_products_v2',
    {
      brand_filter: filters?.brand ?? null,
      category_id_filter: filters?.categoryId ?? null,
      condition_filter: filters?.condition ?? null,
      max_price_filter: filters?.maxPrice ?? null,
      merchant_id_param: merchantId,
      min_price_filter: filters?.minPrice ?? null,
      min_rating_filter: filters?.minRating ?? null,
      parent_only: false,
      result_limit: safeLimit,
      result_offset: safeOffset,
      search_query: sanitizedQuery,
      sort_by: sort,
      status_filter: 'active',
      stock_filter: filters?.stock ?? null,
    }
  );

  if (error) {
    throw error;
  }

  const rankedResults = Array.isArray(rankedResultsRaw) ? rankedResultsRaw : [];
  const productIds = extractProductSearchIds(rankedResults);
  const count = getProductSearchTotalCount(rankedResults);

  if (trackAnalytics) {
    scheduleSearchAnalyticsInsert({
      supabase: analyticsSupabase,
      merchantId,
      query: sanitizedQuery,
      resultsCount: count,
    });
  }

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
  filters?: StorefrontSearchFilters;
  merchantId: string;
  query: string;
  limit: number;
  offset?: number;
  sort?: StorefrontSearchSort;
}): Promise<StorefrontSearchProductsPage> {
  const publicSupabase = createPublicClient({
    clientInfo: 'baci-storefront-search-page',
  });
  const serverSupabase = createClient(await cookies());
  const requestedLimit = clampSearchLimit(args.limit);
  const requestedOffset = normalizeSearchOffset(args.offset);
  const conditionFilter = args.filters?.condition ?? null;
  const needsConditionFamilyFilter = Boolean(
    conditionFilter && !storefrontProductFilters.isAllFilter(conditionFilter)
  );
  const searchFilters = needsConditionFamilyFilter
    ? { ...args.filters, condition: null }
    : args.filters;

  const searchResult = await searchStorefrontProducts({
    supabase: serverSupabase,
    filters: searchFilters,
    merchantId: args.merchantId,
    query: args.query,
    limit: needsConditionFamilyFilter ? 100 : requestedLimit,
    offset: needsConditionFamilyFilter ? 0 : requestedOffset,
    sort: args.sort,
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

  const filteredProducts = needsConditionFamilyFilter
    ? mapped.filter((product) =>
        storefrontProductFilters.matchesStorefrontConditionFilter(
          product,
          conditionFilter ?? ''
        )
      )
    : mapped;
  const products = needsConditionFamilyFilter
    ? filteredProducts.slice(requestedOffset, requestedOffset + requestedLimit)
    : filteredProducts;
  const productIds = needsConditionFamilyFilter
    ? products.map((product) => product.id)
    : searchResult.productIds;

  return {
    ...searchResult,
    count: needsConditionFamilyFilter
      ? filteredProducts.length
      : searchResult.count,
    productIds,
    products,
  };
}
