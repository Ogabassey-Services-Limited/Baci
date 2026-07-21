import { cacheLife, cacheTag } from 'next/cache';
import {
  getPublicSupabaseClient,
  hydrateAndSanitizeProducts,
} from '@/lib/cached-data';
import type { RawDbProduct } from '@/lib/normalize-product';
import { PRODUCT_KEY_SPECS_RELATION_SELECT } from '@/lib/product-key-specs-select';
import { isBrandAuthorityProductInStock } from '@/lib/storefront-category/brand-authority-stock-filter';
import type { BrandAuthorityEntry } from '@/lib/storefront-category/category-hub-types';

const BRAND_AUTHORITY_PRODUCT_LIMIT = 48;
const BRAND_AUTHORITY_QUERY_PAGE_SIZE = 100;
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
  updated_at,
  categories:category_id(id, name, slug),
  product_categories!inner(
    categories!inner(
      id,
      name,
      slug
    )
  )
`;

async function getCachedBrandAuthorityInventoryRead(
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
  const inStockProducts: RawDbProduct[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select(BRAND_AUTHORITY_PRODUCTS_SELECT)
      .eq('merchant_id', merchantId)
      .eq('product_categories.categories.slug', categorySlug)
      .eq('status', 'active')
      .ilike('brand', entry.brandQueryValue)
      .order('updated_at', { ascending: false })
      .range(from, from + BRAND_AUTHORITY_QUERY_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const rawProducts = (data ?? []) as unknown as RawDbProduct[];
    const hydratedProducts = await hydrateAndSanitizeProducts(
      supabase,
      merchantId,
      rawProducts
    );
    inStockProducts.push(
      ...hydratedProducts.filter(isBrandAuthorityProductInStock)
    );

    if (rawProducts.length < BRAND_AUTHORITY_QUERY_PAGE_SIZE) {
      break;
    }
    from += BRAND_AUTHORITY_QUERY_PAGE_SIZE;
  }

  const latestUpdatedAt = inStockProducts[0]?.updated_at;
  return {
    latestUpdatedAt:
      typeof latestUpdatedAt === 'string' ? latestUpdatedAt : null,
    productCount: inStockProducts.length,
    products: inStockProducts,
  };
}

export function getCachedBrandAuthorityInventory(
  merchantId: string,
  categorySlug: string,
  entry: BrandAuthorityEntry
) {
  return getCachedBrandAuthorityInventoryRead(merchantId, categorySlug, entry);
}

export function getCachedBrandAuthorityProducts(
  merchantId: string,
  categorySlug: string,
  entry: BrandAuthorityEntry
) {
  return getCachedBrandAuthorityInventoryRead(
    merchantId,
    categorySlug,
    entry
  ).then((inventory) =>
    inventory.products.slice(0, BRAND_AUTHORITY_PRODUCT_LIMIT)
  );
}
