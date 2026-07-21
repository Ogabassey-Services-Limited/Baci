import { cacheLife, cacheTag } from 'next/cache';
import { getPublicSupabaseClient } from '@/lib/cached-data';
import type { RawDbProduct } from '@/lib/normalize-product';
import { PRODUCT_KEY_SPECS_RELATION_SELECT } from '@/lib/product-key-specs-select';
import { BRAND_AUTHORITY_IN_STOCK_FILTER } from '@/lib/storefront-category/brand-authority-stock-filter';
import type { BrandAuthorityEntry } from '@/lib/storefront-category/category-hub-types';

const BRAND_AUTHORITY_PRODUCT_LIMIT = 48;
const BRAND_AUTHORITY_PRODUCTS_SELECT = `
  id,
  name,
  slug,
  description,
  images,
  category,
  brand,
  price,
  compare_at_price,
  condition,
  stock,
  stock_quantity,
  manage_stock,
  ${PRODUCT_KEY_SPECS_RELATION_SELECT},
  has_condition_offers,
  categories:category_id!inner(id, name, slug),
  product_categories (
    categories (
      id,
      name,
      slug
    )
  )
`;

async function getCachedBrandAuthorityProductsRead(
  merchantId: string,
  categorySlug: string,
  entry: BrandAuthorityEntry
) {
  'use cache';

  try {
    cacheLife('products');
    cacheTag('products', `products-${merchantId}`);
  } catch {
    // Unit tests run without Cache Components enabled.
  }

  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select(BRAND_AUTHORITY_PRODUCTS_SELECT)
    .eq('merchant_id', merchantId)
    .eq('categories.slug', categorySlug)
    .eq('status', 'active')
    .ilike('brand', entry.brandQueryValue)
    .or(BRAND_AUTHORITY_IN_STOCK_FILTER)
    .order('updated_at', { ascending: false })
    .limit(BRAND_AUTHORITY_PRODUCT_LIMIT);

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as RawDbProduct[];
}

export function getCachedBrandAuthorityProducts(
  merchantId: string,
  categorySlug: string,
  entry: BrandAuthorityEntry
) {
  return getCachedBrandAuthorityProductsRead(merchantId, categorySlug, entry);
}
