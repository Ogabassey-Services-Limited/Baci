import {
  getCachedCategories,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import { buildStoreUrl } from '@/lib/store-url';
import { canonicalizeCategorySlug } from '@/lib/storefront-canonical-url';
import { loadSemanticInventorySafely } from '@/lib/storefront-product/load-semantic-inventory-safely';

export async function loadCategoryCompareHubData(input: {
  merchantSlug: string;
  categorySlug: string;
}) {
  const merchant = await getMerchantByIdentifier(input.merchantSlug);

  if (!merchant) {
    return null;
  }

  const requestedCategorySlug = canonicalizeCategorySlug(input.categorySlug);

  if (!requestedCategorySlug) {
    return null;
  }

  const categories = await getCachedCategories(merchant.id);
  const category = categories.find(
    (entry) =>
      entry.is_active !== false &&
      canonicalizeCategorySlug(entry.slug) === requestedCategorySlug
  );

  if (!category?.name) {
    return null;
  }

  const products = await loadSemanticInventorySafely({
    categorySlug: requestedCategorySlug,
    merchantId: merchant.id,
    warningMessage: 'Failed to load category compare hub inventory',
  });

  return {
    categoryName: category.name,
    categorySlug: requestedCategorySlug,
    merchant,
    products,
    storeUrl: buildStoreUrl(merchant),
  };
}
