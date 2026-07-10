import {
  getCachedCategoryPageShellData,
  getPublicSupabaseClient,
} from '@/lib/cached-data';
import { getEffectiveProductStock } from '@/lib/product-stock';
import {
  normalizeProductKeySpecs,
  PRODUCT_SEMANTIC_INVENTORY_BASE_SELECT,
  PRODUCT_SEMANTIC_INVENTORY_LIMIT,
  type ProductSemanticInventoryRow,
  parseSemanticProductPrice,
} from '@/lib/storefront-product/get-cached-product-semantic-inventory';
import type { ProductSemanticCandidate } from '@/lib/storefront-product/product-semantic-types';

export interface CategoryScopedSemanticInventory {
  isCollection: boolean;
  categoryName: string;
  products: ProductSemanticCandidate[];
}

// `id` is selected so a slug-less row can fall back to `slug || id` exactly like
// the old getCachedCategoryPageData -> normalizeProduct path (id-based product
// URLs). Measured null/blank-slug active products for ogabassey = 0, so this is
// defensive parity for other merchants, not a live divergence.
type ScopedSemanticInventoryRow = ProductSemanticInventoryRow & {
  id?: string | null;
};

// category+children scope carries the embedded membership rows so per-product
// category_slug resolution can prefer the REQUESTED slug when the product is a
// direct member (matching normalizeProduct's preferredCategorySlug on the old
// getCachedCategoryPageData path). Filtered by category_id via `!inner` + `.in`.
const SCOPED_SEMANTIC_CATEGORY_SELECT = `
  id,
  ${PRODUCT_SEMANTIC_INVENTORY_BASE_SELECT},
  product_categories!inner(category_id, categories(slug))
`;

// Legacy (pre-canonical-category URLs): non-inner join + ilike membership,
// mirroring getCachedCategoryPageProductIds' legacy branch so this pool can
// never drift from what the category listing itself resolves.
const SCOPED_SEMANTIC_LEGACY_SELECT = `
  id,
  ${PRODUCT_SEMANTIC_INVENTORY_BASE_SELECT},
  product_categories(categories(slug))
`;

function resolveScopedCategorySlug(
  row: ProductSemanticInventoryRow,
  requestedCategorySlug: string
): string {
  const joinedSlugs = (row.product_categories ?? [])
    .flatMap((entry) => {
      const categories = entry?.categories;
      if (Array.isArray(categories)) {
        return categories;
      }
      return categories ? [categories] : [];
    })
    .map((category) => category?.slug?.trim())
    .filter((slug): slug is string => Boolean(slug));

  return (
    joinedSlugs.find((slug) => slug === requestedCategorySlug) ||
    joinedSlugs[0] ||
    requestedCategorySlug
  );
}

function toScopedSemanticCandidate(
  row: ScopedSemanticInventoryRow,
  requestedCategorySlug: string
): ProductSemanticCandidate | null {
  // `slug || id`: mirror normalizeProduct so slug-less rows keep an id-based
  // product URL instead of being dropped from the pool.
  const slug = row.slug?.trim() || (row.id ? String(row.id).trim() : '');
  const name = row.name?.trim();
  const price = parseSemanticProductPrice(row.price);

  if (!slug || !name || price === null) {
    return null;
  }

  return {
    slug,
    name,
    price,
    brand: row.brand,
    condition: row.condition,
    // Effective stock, matching the old normalizeProduct path
    // (getStorefrontAgentAvailability -> getEffectiveProductStock): a product
    // with stock_quantity=0 but a positive legacy `stock` stays in stock, so it
    // is not demoted/filtered out of the SEO link pool. A naive
    // `stock_quantity ?? stock` would zero out those rows (9 live for ogabassey).
    stock: getEffectiveProductStock({
      stock: row.stock,
      stock_quantity: row.stock_quantity,
    }),
    category_slug: resolveScopedCategorySlug(row, requestedCategorySlug),
    product_key_specs: normalizeProductKeySpecs(row.product_key_specs),
  };
}

/**
 * Category+children scoped semantic-link inventory in ONE product query.
 *
 * The PDP and blog SEO link pools previously derived their candidate set from
 * getCachedCategoryPageData — a ~5-hop / ~11-query leg that fetches every
 * active category product (descriptions, images, chunked 48 at a time) purely
 * to feed the link graph. This returns the strict subset those consumers read
 * (slug/name/price/brand/condition/stock/category_slug/key-specs) as a single
 * bounded query, cutting the per-route round-trips that drive connection-pool
 * contention.
 *
 * Scope FIDELITY is load-bearing: it resolves the category+direct-children id
 * set through the SAME getCachedCategoryPageShellData the old path used, so the
 * membership is identical (the exact-slug getCachedProductSemanticInventory
 * would silently drop subcategory products). Proven slug-set-identical against
 * the old path for ogabassey `laptops` (330), `smartphones` (216), and the
 * worst case `gaming` (530) on 2026-07-10.
 *
 * Like getCachedProductSemanticInventory this is deliberately NOT wrapped in a
 * Cache Components directive — the cached shell supplies the shared scope, and
 * transient failures throw (never cached as an empty/stale pool); callers own
 * the optional-content fallback via loadCategoryScopedSemanticInventorySafely.
 */
export async function getCachedCategoryScopedSemanticInventory(
  merchantId: string,
  categorySlug: string,
  storeSlug: string
): Promise<CategoryScopedSemanticInventory> {
  const shell = await getCachedCategoryPageShellData(
    merchantId,
    categorySlug,
    storeSlug
  );
  const fallbackName = shell.fallbackName || categorySlug;

  if (shell.isCollection) {
    return {
      isCollection: true,
      categoryName: shell.name || fallbackName,
      products: [],
    };
  }

  const categoryName = shell.category?.name || fallbackName;
  const scope = shell.productScope;

  // Throw on genuine transient shell failures so this pool is never fixed as a
  // degraded/empty set (mirrors getCachedCompareCategoryInventory). Must run
  // BEFORE the scope branches: a transient category-row failure yields
  // scope.kind === 'legacy'. categoryQueryFailed already excludes PGRST116
  // no-rows, so real legacy URLs keep resolving.
  if (
    shell.categoryQueryFailed ||
    (scope.kind === 'category' && scope.scopeQueryFailed)
  ) {
    throw new Error(
      `Category scoped semantic inventory unavailable for ${categorySlug}`
    );
  }

  if (scope.kind === 'none' || scope.kind === 'collection') {
    return { isCollection: false, categoryName, products: [] };
  }

  const supabase = getPublicSupabaseClient();
  let query = supabase
    .from('products')
    .select(
      scope.kind === 'category'
        ? SCOPED_SEMANTIC_CATEGORY_SELECT
        : SCOPED_SEMANTIC_LEGACY_SELECT
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (scope.kind === 'category') {
    query = query.in('product_categories.category_id', scope.categoryIds);
  } else {
    const sanitizedCategoryName = scope.categoryName.replace(/[,().]/g, '');
    query = query.or(
      `category.ilike.%${sanitizedCategoryName}%,brand.ilike.%${sanitizedCategoryName}%,name.ilike.%${sanitizedCategoryName}%`
    );
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(PRODUCT_SEMANTIC_INVENTORY_LIMIT);

  if (error) {
    console.error('Error fetching category scoped semantic inventory:', {
      merchantId,
      categorySlug,
      error,
    });
    throw error;
  }

  const rows = (data ?? []) as ScopedSemanticInventoryRow[];

  if (rows.length === PRODUCT_SEMANTIC_INVENTORY_LIMIT) {
    // Truncation would silently shrink the SEO link pool for the exact merchant
    // that matters most. Measured worst case is 530 (< 700), so this is a
    // catalog-growth early-warning, not a live condition.
    console.warn('CATEGORY_SEMANTIC_INVENTORY_CAP_HIT', {
      merchantId,
      categorySlug,
      limit: PRODUCT_SEMANTIC_INVENTORY_LIMIT,
    });
  }

  const products = rows
    .map((row) => toScopedSemanticCandidate(row, categorySlug))
    .filter(
      (candidate): candidate is ProductSemanticCandidate => candidate !== null
    );

  return { isCollection: false, categoryName, products };
}
