import { cacheLife, cacheTag } from 'next/cache';
import { hydrateAndSanitizePublicProducts } from '@/lib/hydrate-public-products';
import type { RawDbProduct } from '@/lib/normalize-product';
import { PRODUCT_KEY_SPECS_RELATION_SELECT } from '@/lib/product-key-specs-select';
import { brandAuthorityPublicData } from '@/lib/storefront-category/brand-authority-public-data';
import { isBrandAuthorityProductInStock } from '@/lib/storefront-category/brand-authority-stock-filter';
import { brandAuthorityTaxonomy } from '@/lib/storefront-category/brand-authority-taxonomy';
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

async function readCachedBrandAuthorityInventory(
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

  const supabase = brandAuthorityPublicData.createClient();
  const inStockProducts: RawDbProduct[] = [];
  const requiredProductCount = Math.max(
    BRAND_AUTHORITY_PRODUCT_LIMIT,
    entry.minimumProducts
  );
  let productCountIsLowerBound = false;
  let from = 0;

  while (true) {
    const brandQueryValues = brandAuthorityTaxonomy.getBrandQueryValues(entry);
    const baseQuery = supabase
      .from('products')
      .select(BRAND_AUTHORITY_PRODUCTS_SELECT)
      .eq('merchant_id', merchantId)
      .eq('product_categories.categories.slug', categorySlug)
      .eq('status', 'active');
    const brandQuery =
      brandQueryValues.length === 1
        ? baseQuery
            .or('is_parent.eq.true,parent_product_id.is.null')
            .ilike('brand', brandQueryValues[0])
        : baseQuery.or(
            brandQueryValues
              .flatMap((value) => [
                `and(is_parent.eq.true,brand.ilike.${value})`,
                `and(parent_product_id.is.null,brand.ilike.${value})`,
              ])
              .join(',')
          );
    const { data, error } = await brandQuery
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + BRAND_AUTHORITY_QUERY_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const rawProducts = (data ?? []) as unknown as RawDbProduct[];
    const hydratedProducts = await hydrateAndSanitizePublicProducts(
      supabase,
      merchantId,
      rawProducts
    );
    inStockProducts.push(
      ...hydratedProducts.filter(isBrandAuthorityProductInStock)
    );

    if (
      rawProducts.length < BRAND_AUTHORITY_QUERY_PAGE_SIZE ||
      inStockProducts.length >= requiredProductCount
    ) {
      productCountIsLowerBound =
        rawProducts.length === BRAND_AUTHORITY_QUERY_PAGE_SIZE &&
        inStockProducts.length >= requiredProductCount;
      break;
    }
    from += BRAND_AUTHORITY_QUERY_PAGE_SIZE;
  }

  const latestUpdatedAt = inStockProducts[0]?.updated_at;
  return {
    latestUpdatedAt:
      typeof latestUpdatedAt === 'string' ? latestUpdatedAt : null,
    productCount: inStockProducts.length,
    productCountIsLowerBound,
    products: inStockProducts,
  };
}

export function getCachedBrandAuthorityInventory(
  merchantId: string,
  categorySlug: string,
  entry: BrandAuthorityEntry
) {
  return readCachedBrandAuthorityInventory(merchantId, categorySlug, entry);
}
