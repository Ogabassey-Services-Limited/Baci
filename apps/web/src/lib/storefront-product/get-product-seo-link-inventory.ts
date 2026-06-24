import { getPublicSupabaseClient } from '@/lib/cached-data';
import type { ProductSemanticCandidate } from '@/lib/storefront-product/product-semantic-types';
import {
  getProductSeoSelect,
  mergeProductCandidates,
  normalizeCategorySlugForSearch,
  type ProductSeoRow,
  throwSeoInventoryError,
  toProductSemanticCandidate,
} from './get-product-seo-link-inventory-normalize';

type CategoryScope =
  | { kind: 'category'; categoryIds: string[] }
  | { kind: 'legacy'; categoryName: string }
  | { kind: 'none' };

const SEO_LINK_INVENTORY_LIMIT = 48;
const SEO_LINK_CATEGORY_SCOPE_LIMIT = 100;

interface CategoryRow {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  is_active?: boolean | null;
}

interface CategorySlugStateRow {
  is_active?: boolean | null;
}

interface SeoQueryBuilder<TData> {
  select(columns: string): SeoQueryBuilder<TData>;
  eq(column: string, value: unknown): SeoQueryBuilder<TData>;
  or(filters: string): SeoQueryBuilder<TData>;
  in(column: string, values: unknown[]): SeoQueryBuilder<TData>;
  order(
    column: string,
    options?: { ascending?: boolean }
  ): SeoQueryBuilder<TData>;
  limit(count: number): Promise<{ data: TData | null; error: unknown | null }>;
  maybeSingle(): Promise<{ data: TData | null; error: unknown | null }>;
}

interface SeoSupabaseClient {
  from<TData>(table: string): SeoQueryBuilder<TData>;
  rpc<TData>(
    fn: string,
    args: Record<string, unknown>
  ): Promise<{ data: TData | null; error: unknown | null }>;
}

function getSeoSupabaseClient(): SeoSupabaseClient {
  return getPublicSupabaseClient() as unknown as SeoSupabaseClient;
}

export async function getProductSeoInventory(
  merchantId: string,
  categorySlug: string,
  productId: string
): Promise<ProductSemanticCandidate[]> {
  const [scope, currentProduct] = await Promise.all([
    getSeoCategoryScope(merchantId, categorySlug),
    getCurrentProductSeoCandidate(merchantId, productId, categorySlug),
  ]);
  const scopedProducts = await getScopedProductSeoInventory(
    merchantId,
    categorySlug,
    scope
  );
  return mergeProductCandidates(
    currentProduct ? [currentProduct, ...scopedProducts] : scopedProducts
  );
}

async function getSeoCategoryScope(
  merchantId: string,
  categorySlug: string
): Promise<CategoryScope> {
  const supabase = getSeoSupabaseClient();
  const { data: category, error } = await supabase
    .from<CategoryRow>('categories')
    .select('id, name, slug, is_active')
    .eq('merchant_id', merchantId)
    .eq('slug', categorySlug)
    .maybeSingle();

  if (error) {
    throwSeoInventoryError('category scope lookup failed', {
      merchantId,
      categorySlug,
      error,
    });
  }

  const categoryRow = category as CategoryRow | null;
  if (!categoryRow) {
    const categoryState = await getHiddenCategorySlugState(
      merchantId,
      categorySlug
    );
    if (categoryState?.is_active === false) {
      return { kind: 'none' };
    }

    return {
      kind: 'legacy',
      categoryName: normalizeCategorySlugForSearch(categorySlug),
    };
  }
  if (categoryRow.is_active === false || !categoryRow.id) {
    return { kind: 'none' };
  }

  const { data: categoryScope, error: categoryScopeError } = await supabase
    .from<Array<{ id?: string | null }>>('categories')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .or(`id.eq.${categoryRow.id},parent_id.eq.${categoryRow.id}`)
    .limit(SEO_LINK_CATEGORY_SCOPE_LIMIT);

  if (categoryScopeError) {
    throwSeoInventoryError('category scope expansion failed', {
      merchantId,
      categorySlug,
      error: categoryScopeError,
    });
  }

  const categoryIds = Array.from(
    new Set(
      [
        categoryRow.id,
        ...((categoryScope ?? []) as Array<{ id?: string | null }>).map(
          (row) => row.id
        ),
      ].filter((id): id is string => Boolean(id))
    )
  );
  return categoryIds.length
    ? { kind: 'category', categoryIds }
    : { kind: 'none' };
}

async function getCurrentProductSeoCandidate(
  merchantId: string,
  productId: string,
  categorySlug: string
): Promise<ProductSemanticCandidate | null> {
  if (!productId) {
    return null;
  }

  const { data, error } = await getSeoSupabaseClient()
    .from<ProductSeoRow[]>('products')
    .select(getProductSeoSelect(false))
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .eq('id', productId)
    .limit(1);

  if (error) {
    throwSeoInventoryError('current product lookup failed', {
      merchantId,
      productId,
      error,
    });
  }

  const product = (data ?? [])[0];
  return product ? toProductSemanticCandidate(product, categorySlug) : null;
}

async function getScopedProductSeoInventory(
  merchantId: string,
  categorySlug: string,
  scope: CategoryScope
): Promise<ProductSemanticCandidate[]> {
  if (scope.kind === 'none') {
    return [];
  }

  if (scope.kind === 'category') {
    const [directProducts, joinedProducts] = await Promise.all([
      getCategoryScopedProductSeoRows(
        merchantId,
        categorySlug,
        false,
        'category_id',
        scope.categoryIds
      ),
      getCategoryScopedProductSeoRows(
        merchantId,
        categorySlug,
        true,
        'product_categories.category_id',
        scope.categoryIds
      ),
    ]);
    return mergeProductCandidates([...directProducts, ...joinedProducts]).slice(
      0,
      SEO_LINK_INVENTORY_LIMIT
    );
  }

  let query = getSeoSupabaseClient()
    .from<ProductSeoRow[]>('products')
    .select(getProductSeoSelect(false))
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (scope.categoryName) {
    query = query.or(
      `category.ilike.%${scope.categoryName}%,brand.ilike.%${scope.categoryName}%,name.ilike.%${scope.categoryName}%`
    );
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(SEO_LINK_INVENTORY_LIMIT);

  if (error) {
    throwSeoInventoryError('scoped inventory lookup failed', {
      merchantId,
      categorySlug,
      error,
    });
  }

  return (data ?? [])
    .map((product) => toProductSemanticCandidate(product, categorySlug))
    .filter(
      (candidate): candidate is ProductSemanticCandidate => candidate !== null
    );
}

async function getCategoryScopedProductSeoRows(
  merchantId: string,
  categorySlug: string,
  isCategoryScoped: boolean,
  filterColumn: string,
  categoryIds: string[]
): Promise<ProductSemanticCandidate[]> {
  const { data, error } = await getSeoSupabaseClient()
    .from<ProductSeoRow[]>('products')
    .select(getProductSeoSelect(isCategoryScoped))
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .in(filterColumn, categoryIds)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(SEO_LINK_INVENTORY_LIMIT);

  if (error) {
    throwSeoInventoryError('scoped inventory lookup failed', {
      merchantId,
      categorySlug,
      filterColumn,
      error,
    });
  }

  return (data ?? [])
    .map((product) => toProductSemanticCandidate(product, categorySlug))
    .filter(
      (candidate): candidate is ProductSemanticCandidate => candidate !== null
    );
}

async function getHiddenCategorySlugState(
  merchantId: string,
  categorySlug: string
): Promise<CategorySlugStateRow | null> {
  const { data, error } = await getSeoSupabaseClient().rpc<
    CategorySlugStateRow[]
  >('get_storefront_category_slug_state', {
    p_merchant_id: merchantId,
    p_slug: categorySlug,
  });

  if (error) {
    throwSeoInventoryError('category slug state lookup failed', {
      merchantId,
      categorySlug,
      error,
    });
  }

  return (data ?? [])[0] ?? null;
}
