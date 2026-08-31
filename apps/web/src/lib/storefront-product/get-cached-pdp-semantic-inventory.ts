import { cacheLife, cacheTag } from 'next/cache';
import { getCategoryPageDataCacheTag } from '@/lib/category-page-cache-tags';
import { getPublicSupabaseClient } from '@/lib/public-supabase-client';
import { getCachedCompareCategoryShell } from '@/lib/storefront-compare/get-cached-compare-category-shell';
import {
  getProductSeoSelect,
  mergeProductCandidates,
  type ProductSeoRow,
  toProductSemanticCandidate,
} from './get-product-seo-link-inventory-normalize';
import { PDP_SEMANTIC_INVENTORY_LIMIT } from './pdp-semantic-inventory-limit';
import type { ProductSemanticCandidate } from './product-semantic-types';

const PDP_SEMANTIC_INVENTORY_TIMEOUT_MS = 3_000;

/**
 * Loads the small candidate pool used by the PDP semantic sections.
 *
 * The cache key is merchant + category, not merchant + product. The previous
 * combined snapshot RPC rebuilt this same category pool for every PDP and
 * coupled it to the product-guide and cluster-guide reads. Keeping the pool
 * as its own local cache entry lets neighboring PDPs reuse one bounded read
 * while still throwing on a transient fill failure (so an empty pool is never
 * persisted as a successful snapshot).
 */
export function getCachedPdpSemanticInventory(
  merchantId: string,
  categorySlug: string,
  storeSlug: string
): Promise<ProductSemanticCandidate[]> {
  // The cache key is computed before a `'use cache'` function body runs. Keep
  // bot-controlled category values outside that boundary; the PDP route's
  // canonical product category is normally already slug-safe, but this guard
  // also protects direct callers and malformed legacy URLs.
  const normalizedCategorySlug = categorySlug.trim().toLowerCase();
  if (
    !normalizedCategorySlug ||
    normalizedCategorySlug.length > 64 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedCategorySlug)
  ) {
    return Promise.resolve([]);
  }

  return getCachedPdpSemanticInventoryForSafeCategory(
    merchantId,
    normalizedCategorySlug,
    storeSlug
  );
}

async function getCachedPdpSemanticInventoryForSafeCategory(
  merchantId: string,
  categorySlug: string,
  storeSlug: string
): Promise<ProductSemanticCandidate[]> {
  'use cache';

  try {
    cacheLife('products');
    cacheTag(
      'products',
      'categories',
      `products-${merchantId}`,
      `categories-${merchantId}`,
      getCategoryPageDataCacheTag(merchantId),
      `seo-pdp-inventory-${merchantId}-${categorySlug}`
    );
  } catch {
    // Unit tests do not run with Next cacheComponents enabled.
  }

  const shell = await getCachedCompareCategoryShell(
    merchantId,
    categorySlug,
    storeSlug
  );

  if (shell.isCollection || shell.productScope.kind === 'none') {
    return [];
  }

  const supabase = getPublicSupabaseClient();
  const scope = shell.productScope;
  const isCategoryScoped = scope.kind === 'category';
  let query = supabase
    .from('products')
    .select(getProductSeoSelect(isCategoryScoped))
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (scope.kind === 'category') {
    if (scope.categoryIds.length === 0) return [];
    query = query.in('product_categories.category_id', scope.categoryIds);
  } else if (scope.kind === 'legacy') {
    const sanitizedCategoryName = scope.categoryName.replace(/[,().]/g, '');
    if (!sanitizedCategoryName) return [];
    query = query.or(
      `category.ilike.%${sanitizedCategoryName}%,brand.ilike.%${sanitizedCategoryName}%,name.ilike.%${sanitizedCategoryName}%`
    );
  }

  const boundedQuery = query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(PDP_SEMANTIC_INVENTORY_LIMIT)
    .abortSignal(AbortSignal.timeout(PDP_SEMANTIC_INVENTORY_TIMEOUT_MS));
  const singleAttemptQuery =
    typeof boundedQuery.retry === 'function'
      ? boundedQuery.retry(false)
      : boundedQuery;
  const { data, error } = await singleAttemptQuery;

  if (error) {
    throw error;
  }

  return mergeProductCandidates(
    ((data ?? []) as ProductSeoRow[])
      .map((row) => toProductSemanticCandidate(row, categorySlug))
      .filter(
        (candidate): candidate is ProductSemanticCandidate => candidate !== null
      )
  );
}
