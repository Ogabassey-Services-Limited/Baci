import {
  getCachedCategories,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import { buildStoreUrl } from '@/lib/store-url';
import { canonicalizeCategorySlug } from '@/lib/storefront-canonical-url';
import { loadSemanticInventorySafely } from '@/lib/storefront-product/load-semantic-inventory-safely';
import type { ProductSemanticCandidate } from '@/lib/storefront-product/product-semantic-types';

type CachedCategory = Awaited<ReturnType<typeof getCachedCategories>>[number];

interface CategoryCompareHubProductGroup {
  categoryName: string;
  categorySlug: string;
  products: ProductSemanticCandidate[];
}

function isVisibleCategory(category: CachedCategory) {
  return category.is_active !== false;
}

function isActiveChildCategory(
  category: CachedCategory,
  parentCategoryId: string
) {
  return category.parent_id === parentCategoryId && category.is_active === true;
}

function buildCategoryProductGroups(input: {
  categories: CachedCategory[];
  category: CachedCategory;
  merchantId: string;
}): Promise<CategoryCompareHubProductGroup[]> {
  const scopedCategories = [
    input.category,
    ...input.categories.filter((category) =>
      isActiveChildCategory(category, input.category.id)
    ),
  ];
  const seenSlugs = new Set<string>();

  return Promise.all(
    scopedCategories.flatMap((category) => {
      const categorySlug = canonicalizeCategorySlug(category.slug);
      const categoryName = category.name?.trim();

      if (!categorySlug || !categoryName || seenSlugs.has(categorySlug)) {
        return [];
      }

      seenSlugs.add(categorySlug);

      return [
        loadSemanticInventorySafely({
          categorySlug,
          merchantId: input.merchantId,
          warningMessage: 'Failed to load category compare hub inventory',
        }).then((products) => ({
          categoryName,
          categorySlug,
          products,
        })),
      ];
    })
  );
}

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
      isVisibleCategory(entry) &&
      canonicalizeCategorySlug(entry.slug) === requestedCategorySlug
  );

  if (!category?.name) {
    return null;
  }

  const productGroups = await buildCategoryProductGroups({
    categories,
    category,
    merchantId: merchant.id,
  });

  return {
    categoryName: category.name,
    categorySlug: requestedCategorySlug,
    merchant,
    productGroups,
    products: productGroups.flatMap((group) => group.products),
    storeUrl: buildStoreUrl(merchant),
  };
}
