import {
  getCachedCategories,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import { buildStoreUrl } from '@/lib/store-url';
import { canonicalizeCategorySlug } from '@/lib/storefront-canonical-url';
import { getCachedProductSemanticInventory } from '@/lib/storefront-product/get-cached-product-semantic-inventory';
import type { ProductSemanticCandidate } from '@/lib/storefront-product/product-semantic-types';

type CachedCategory = Awaited<ReturnType<typeof getCachedCategories>>[number];

interface CategoryCompareHubProductGroup {
  categoryName: string;
  categorySlug: string;
  products: ProductSemanticCandidate[];
  // True when this group's inventory load THREW (fail-open to []). Consumers
  // must not treat a degraded empty hub as genuinely empty — a transient
  // failure must never become a (briefly edge-cacheable) 404 on a live hub.
  inventoryLoadFailed: boolean;
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
        getCachedProductSemanticInventory(input.merchantId, categorySlug).then(
          (products) => ({
            categoryName,
            categorySlug,
            products,
            inventoryLoadFailed: false,
          }),
          (error: unknown) => {
            console.warn('Failed to load category compare hub inventory', {
              categorySlug,
              merchantId: input.merchantId,
              error,
            });

            return {
              categoryName,
              categorySlug,
              products: [],
              inventoryLoadFailed: true,
            };
          }
        ),
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
    productGroups: productGroups.map(
      ({ categoryName, categorySlug, products }) => ({
        categoryName,
        categorySlug,
        products,
      })
    ),
    products: productGroups.flatMap((group) => group.products),
    inventoryDegraded: productGroups.some((group) => group.inventoryLoadFailed),
    storeUrl: buildStoreUrl(merchant),
  };
}
