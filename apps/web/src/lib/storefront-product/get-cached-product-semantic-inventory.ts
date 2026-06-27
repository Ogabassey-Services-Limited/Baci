import { cacheLife, cacheTag } from 'next/cache';
import { getPublicSupabaseClient } from '@/lib/cached-data';
import { PRODUCT_KEY_SPECS_RELATION_SELECT } from '@/lib/product-key-specs-select';
import type { ProductSemanticCandidate } from '@/lib/storefront-product/product-semantic-types';

const PRODUCT_SEMANTIC_INVENTORY_LIMIT = 300;

interface ProductSemanticInventoryCategoryJoin {
  categories?:
    | { slug?: string | null }
    | Array<{ slug?: string | null }>
    | null;
}

interface ProductSemanticInventoryRow {
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

const PRODUCT_SEMANTIC_INVENTORY_SELECT = `
  slug,
  name,
  price,
  brand,
  condition,
  stock,
  stock_quantity,
  product_categories!inner(categories!inner(slug)),
  ${PRODUCT_KEY_SPECS_RELATION_SELECT}
`;

export async function getCachedProductSemanticInventory(
  merchantId: string,
  categorySlug: string
): Promise<ProductSemanticCandidate[]> {
  'use cache: remote';
  cacheLife('products');
  cacheTag(
    'products',
    `products-${merchantId}`,
    `seo-inventory-${merchantId}-${categorySlug}`
  );

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

function parseSemanticProductPrice(value: unknown): number | null {
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

function normalizeProductKeySpecs(
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
