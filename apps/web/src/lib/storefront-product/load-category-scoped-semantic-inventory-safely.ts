import {
  type CategoryScopedSemanticInventory,
  getCachedCategoryScopedSemanticInventory,
} from '@/lib/storefront-product/get-cached-category-scoped-semantic-inventory';

interface LoadCategoryScopedSemanticInventorySafelyInput {
  merchantId: string;
  categorySlug: string;
  storeSlug: string;
  warningMessage: string;
}

/**
 * Optional-content fallback around getCachedCategoryScopedSemanticInventory.
 * The SEO link pool is supplemental — a transient inventory failure must not
 * error the PDP or blog page, so it degrades to an empty pool (matching the
 * old getCachedCategoryPageData path, which returned no products on failure).
 */
export async function loadCategoryScopedSemanticInventorySafely({
  merchantId,
  categorySlug,
  storeSlug,
  warningMessage,
}: LoadCategoryScopedSemanticInventorySafelyInput): Promise<CategoryScopedSemanticInventory> {
  try {
    return await getCachedCategoryScopedSemanticInventory(
      merchantId,
      categorySlug,
      storeSlug
    );
  } catch (error) {
    console.warn(warningMessage, {
      categorySlug,
      merchantId,
      error,
    });

    return { isCollection: false, categoryName: categorySlug, products: [] };
  }
}
