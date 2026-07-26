import { cacheLife, cacheTag } from 'next/cache';
import { getCategoryPageDataCacheTag } from '@/lib/category-page-cache-tags';
import { getPublicSupabaseClient } from '@/lib/public-supabase-client';

export type SpecialCollectionSlug =
  | 'new-arrivals'
  | 'best-sellers'
  | 'on-sale'
  | 'featured';

export type CachedCategoryPageProductScope =
  | { categoryId: string; categoryIds: string[]; kind: 'category' }
  | { collectionSlug: SpecialCollectionSlug; kind: 'collection' }
  | { categoryName: string; kind: 'legacy' }
  | { kind: 'none' };

export const CATEGORY_PAGE_PRODUCT_ID_CAP = 2000;

type ActiveCategoryPageProductScope = Exclude<
  CachedCategoryPageProductScope,
  { kind: 'none' }
>;

type RemotelyCachedCategoryPageProductScope = Exclude<
  CachedCategoryPageProductScope,
  { kind: 'legacy' }
>;

function buildCategoryPageProductIdsQuery(
  supabase: ReturnType<typeof getPublicSupabaseClient>,
  merchantId: string,
  scope: ActiveCategoryPageProductScope,
  selectOptions?: { count: 'exact'; head: boolean }
) {
  if (scope.kind === 'category') {
    return supabase
      .from('products')
      .select('id, product_categories!inner(category_id)', selectOptions)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .in('product_categories.category_id', scope.categoryIds)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });
  }

  if (scope.kind === 'legacy') {
    const sanitizedCategoryName = scope.categoryName.replace(/[,().]/g, '');
    return supabase
      .from('products')
      .select('id', selectOptions)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .or(
        `category.ilike.%${sanitizedCategoryName}%,brand.ilike.%${sanitizedCategoryName}%,name.ilike.%${sanitizedCategoryName}%`
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });
  }

  let query = supabase
    .from('products')
    .select('id', selectOptions)
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  switch (scope.collectionSlug) {
    case 'new-arrivals':
      query = query
        .order('created_at', { ascending: false })
        .order('id', { ascending: true });
      break;
    case 'best-sellers':
      query = query
        .order('rating', { ascending: false })
        .order('id', { ascending: true });
      break;
    case 'on-sale':
      query = query
        .not('compare_at_price', 'is', null)
        .order('updated_at', { ascending: false })
        .order('id', { ascending: true });
      break;
    case 'featured':
      query = query
        .order('price', { ascending: false })
        .order('id', { ascending: true });
      break;
  }

  return query;
}

function extractCategoryPageProductIds(data: unknown): string[] {
  return ((data || []) as Array<{ id?: string | null }>)
    .map((product) => product.id)
    .filter((id): id is string => Boolean(id));
}

/**
 * Remote canonical IDs/counts use merchant-scoped category tags so product or
 * category mutations propagate without evicting other merchants' entries.
 */
async function getCachedCategoryPageProductIds({
  merchantId,
  scope,
}: {
  merchantId: string;
  scope: RemotelyCachedCategoryPageProductScope;
}): Promise<string[]> {
  'use cache: remote';
  cacheLife('storefront-page');
  cacheTag(
    getCategoryPageDataCacheTag(merchantId),
    'products',
    'categories',
    `products-${merchantId}`,
    `categories-${merchantId}`
  );

  if (scope.kind === 'none') return [];

  const { data, error } = await buildCategoryPageProductIdsQuery(
    getPublicSupabaseClient(),
    merchantId,
    scope
  ).limit(CATEGORY_PAGE_PRODUCT_ID_CAP);
  if (error) throw error;
  return extractCategoryPageProductIds(data);
}

async function getCachedLegacyCategoryPageProductIds({
  merchantId,
  scope,
}: {
  merchantId: string;
  scope: Extract<CachedCategoryPageProductScope, { kind: 'legacy' }>;
}): Promise<string[]> {
  'use cache';
  cacheLife('storefront-page');
  cacheTag(
    getCategoryPageDataCacheTag(merchantId),
    'products',
    'categories',
    `products-${merchantId}`,
    `categories-${merchantId}`
  );

  const { data, error } = await buildCategoryPageProductIdsQuery(
    getPublicSupabaseClient(),
    merchantId,
    scope
  ).limit(CATEGORY_PAGE_PRODUCT_ID_CAP);
  if (error) throw error;
  return extractCategoryPageProductIds(data);
}

async function getCachedCategoryPageProductTotalCount({
  merchantId,
  scope,
}: {
  merchantId: string;
  scope: RemotelyCachedCategoryPageProductScope;
}): Promise<number> {
  'use cache: remote';
  cacheLife('storefront-page');
  cacheTag(
    getCategoryPageDataCacheTag(merchantId),
    'products',
    'categories',
    `products-${merchantId}`,
    `categories-${merchantId}`
  );

  if (scope.kind === 'none') return 0;

  const { count, error } = await buildCategoryPageProductIdsQuery(
    getPublicSupabaseClient(),
    merchantId,
    scope,
    { count: 'exact', head: true }
  );
  if (error) throw error;
  return count ?? 0;
}

async function getCachedLegacyCategoryPageProductTotalCount({
  merchantId,
  scope,
}: {
  merchantId: string;
  scope: Extract<CachedCategoryPageProductScope, { kind: 'legacy' }>;
}): Promise<number> {
  'use cache';
  cacheLife('storefront-page');
  cacheTag(
    getCategoryPageDataCacheTag(merchantId),
    'products',
    'categories',
    `products-${merchantId}`,
    `categories-${merchantId}`
  );

  const { count, error } = await buildCategoryPageProductIdsQuery(
    getPublicSupabaseClient(),
    merchantId,
    scope,
    { count: 'exact', head: true }
  );
  if (error) throw error;
  return count ?? 0;
}

async function fetchCategoryPageProductIdWindow({
  from,
  merchantId,
  scope,
  to,
}: {
  from: number;
  merchantId: string;
  scope: CachedCategoryPageProductScope;
  to: number;
}): Promise<string[]> {
  if (scope.kind === 'none') return [];

  const { data, error } = await buildCategoryPageProductIdsQuery(
    getPublicSupabaseClient(),
    merchantId,
    scope
  ).range(from, to);
  if (error) throw error;
  return extractCategoryPageProductIds(data);
}

export const categoryPageProductIdCache = {
  fetchProductIdWindow: fetchCategoryPageProductIdWindow,
  getLegacyProductIds: getCachedLegacyCategoryPageProductIds,
  getLegacyProductTotalCount: getCachedLegacyCategoryPageProductTotalCount,
  getProductIds: getCachedCategoryPageProductIds,
  getProductTotalCount: getCachedCategoryPageProductTotalCount,
};
