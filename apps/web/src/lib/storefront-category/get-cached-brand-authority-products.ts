import type { BrandAuthorityEntry } from '@/lib/storefront-category/category-hub-types';
import { getCachedBrandAuthorityInventory } from '@/lib/storefront-category/get-cached-brand-authority-inventory';

const BRAND_AUTHORITY_PRODUCT_LIMIT = 48;

export async function getCachedBrandAuthorityProducts(
  merchantId: string,
  categorySlug: string,
  entry: BrandAuthorityEntry
) {
  const inventory = await getCachedBrandAuthorityInventory(
    merchantId,
    categorySlug,
    entry
  );
  return inventory.products.slice(0, BRAND_AUTHORITY_PRODUCT_LIMIT);
}
