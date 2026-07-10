import { getPublicSupabaseClient } from '@/lib/cached-data';
import { PRODUCT_KEY_SPECS_RELATION_SELECT } from '@/lib/product-key-specs-select';
import type { ProductSemanticCandidate } from '@/lib/storefront-product/product-semantic-types';

/**
 * Upper bound on rows pulled for a single category's semantic-link inventory.
 *
 * Raised from 300 to 700 when the category+children scoped variant
 * (getCachedCategoryScopedSemanticInventory) began feeding the PDP and blog SEO
 * link pools that previously came from getCachedCategoryPageData — which is
 * UNCAPPED over the category+direct-children scope. A naive swap onto the old
 * 300 bound would have silently truncated the largest scoped pools.
 *
 * Measured worst case across the ogabassey catalog (merchant
 * 6b5cb8a4-5575-456c-b936-8cdfae30db74) on 2026-07-10:
 *   - category+children scope: `gaming` = 530 active products (14 direct + 516
 *     across 9 child categories) — the true worst case, not `laptops` (330).
 *   - exact-slug scope (this function's default consumers): `laptops` = 293.
 * 700 clears the 530 worst case with ~32% headroom, and stays below the point
 * (~1.15K rows at ~1.7KB/row) where the key-specs payload would approach a
 * remote data-cache per-item byte ceiling, so a future cached variant is safe.
 */
export const PRODUCT_SEMANTIC_INVENTORY_LIMIT = 700;

export interface ProductSemanticInventoryCategoryJoin {
  categories?:
    | { slug?: string | null }
    | Array<{ slug?: string | null }>
    | null;
}

export interface ProductSemanticInventoryRow {
  brand?: string | null;
  condition?: string | null;
  name?: string | null;
  price?: number | string | null;
  product_categories?: ProductSemanticInventoryCategoryJoin[] | null;
  product_key_specs?:
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null;
  slug?: string | null;
  stock?: number | null;
  stock_quantity?: number | null;
}

/**
 * Product-column projection shared by the exact-slug inventory (this file) and
 * the category+children scoped variant. The `product_categories` embed differs
 * between the two (exact-slug filters on categories.slug; the scoped variant
 * filters on category_id), so each composes its own join clause onto this base.
 */
export const PRODUCT_SEMANTIC_INVENTORY_BASE_SELECT = `
  slug,
  name,
  price,
  brand,
  condition,
  stock,
  stock_quantity,
  ${PRODUCT_KEY_SPECS_RELATION_SELECT}
`;

const PRODUCT_SEMANTIC_INVENTORY_SELECT = `
  ${PRODUCT_SEMANTIC_INVENTORY_BASE_SELECT},
  product_categories!inner(categories!inner(slug))
`;

/**
 * Loads the bounded semantic-link inventory directly from the public data API.
 * The legacy name is retained for call-site compatibility, but this function
 * deliberately has no Cache Components directive: transient query failures
 * must not become large shared empty/stale entries, and callers own the
 * optional-content fallback.
 */
export async function getCachedProductSemanticInventory(
  merchantId: string,
  categorySlug: string
): Promise<ProductSemanticCandidate[]> {
  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SEMANTIC_INVENTORY_SELECT)
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .eq('product_categories.categories.slug', categorySlug)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(PRODUCT_SEMANTIC_INVENTORY_LIMIT);

  if (error) {
    console.error('Error fetching product semantic inventory:', {
      merchantId,
      categorySlug,
      error,
    });
    throw error;
  }

  return ((data ?? []) as ProductSemanticInventoryRow[])
    .map((row) => toProductSemanticCandidate(row, categorySlug))
    .filter(
      (candidate): candidate is ProductSemanticCandidate => candidate !== null
    );
}

export function parseSemanticProductPrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) {
      return null;
    }

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function normalizeProductKeySpecs(
  value: ProductSemanticInventoryRow['product_key_specs']
): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === 'object' ? first : null;
  }

  return value && typeof value === 'object' ? value : null;
}

function getJoinedCategorySlug(
  row: ProductSemanticInventoryRow
): string | null {
  const firstCategoryJoin = row.product_categories?.[0];
  const categories = firstCategoryJoin?.categories;
  const category = Array.isArray(categories) ? categories[0] : categories;
  return category?.slug?.trim() || null;
}

function toProductSemanticCandidate(
  row: ProductSemanticInventoryRow,
  fallbackCategorySlug: string
): ProductSemanticCandidate | null {
  const slug = row.slug?.trim();
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
    stock: row.stock_quantity ?? row.stock,
    category_slug: getJoinedCategorySlug(row) ?? fallbackCategorySlug,
    product_key_specs: normalizeProductKeySpecs(row.product_key_specs),
  };
}
