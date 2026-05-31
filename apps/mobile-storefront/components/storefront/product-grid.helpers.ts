import type { Category } from '@/hooks';
import {
  ALL_PRODUCT_FILTER_CATEGORY_SLUG,
  normalizeSelectedCategorySlug,
} from '@/lib/product-filter-options';
import type { Product } from '@/types/product';

interface ResolveNormalizedCategoryIdOptions {
  selectedCategoryId: string | null;
  selectedCategoryIdFromFilter: string | null | undefined;
  selectedCategorySlug: string;
}

export function resolveNormalizedCategoryId({
  selectedCategoryId,
  selectedCategoryIdFromFilter,
  selectedCategorySlug,
}: ResolveNormalizedCategoryIdOptions): string | undefined {
  if (selectedCategoryIdFromFilter) {
    return selectedCategoryIdFromFilter;
  }

  if (
    selectedCategorySlug === ALL_PRODUCT_FILTER_CATEGORY_SLUG &&
    selectedCategoryId &&
    !selectedCategoryId.startsWith('u-')
  ) {
    return selectedCategoryId;
  }

  return undefined;
}

interface ResolveSelectedCategoryNameOptions {
  categoryNames: string[];
  normalizedCategories: Category[];
  selectedCategorySlug: string;
}

export function resolveSelectedCategoryName({
  categoryNames,
  normalizedCategories,
  selectedCategorySlug,
}: ResolveSelectedCategoryNameOptions): {
  matchedCategoryName: string | undefined;
  selectedCategoryName: string;
} {
  const matchedCategoryName =
    selectedCategorySlug === ALL_PRODUCT_FILTER_CATEGORY_SLUG
      ? 'All'
      : categoryNames.find(
          (categoryName) =>
            normalizeSelectedCategorySlug(
              categoryName,
              normalizedCategories
            ) === selectedCategorySlug
        );

  return {
    matchedCategoryName,
    selectedCategoryName: matchedCategoryName ?? 'All',
  };
}

interface FilterProductsByClientCategoryOptions {
  normalizedCategories: Category[];
  products: Product[];
  selectedCategorySlug: string;
}

export function filterProductsByClientCategory({
  normalizedCategories,
  products,
  selectedCategorySlug,
}: FilterProductsByClientCategoryOptions): Product[] {
  const selectedClientSideCategorySlug =
    normalizedCategories.length === 0 &&
    selectedCategorySlug !== ALL_PRODUCT_FILTER_CATEGORY_SLUG
      ? selectedCategorySlug
      : null;
  const shouldFilterProductsClientSide =
    selectedClientSideCategorySlug !== null &&
    selectedClientSideCategorySlug.length > 0;

  if (!shouldFilterProductsClientSide) {
    return products;
  }

  return products.filter((product) => {
    const productCategory = product.category?.trim();
    if (!productCategory) return false;

    return (
      normalizeSelectedCategorySlug(productCategory, normalizedCategories) ===
      selectedClientSideCategorySlug
    );
  });
}

interface ResolveProductGridRenderFlagsOptions {
  isCategoriesError: boolean;
  isCategoriesFetching: boolean;
  isError: boolean;
  isFetchedAfterMount: boolean;
  isLoading: boolean;
  productsLength: number;
  uniqueVisibleProductsLength: number;
}

export function resolveProductGridRenderFlags({
  isCategoriesError,
  isCategoriesFetching,
  isError,
  isFetchedAfterMount,
  isLoading,
  productsLength,
  uniqueVisibleProductsLength,
}: ResolveProductGridRenderFlagsOptions) {
  const hasRenderableProducts =
    uniqueVisibleProductsLength > 0 || productsLength > 0;

  return {
    hasRenderableProducts,
    isRetrying: isCategoriesError && isCategoriesFetching,
    shouldShowFatalError:
      isError && isFetchedAfterMount && !isLoading && !hasRenderableProducts,
    shouldShowInitialLoading: !hasRenderableProducts && !isFetchedAfterMount,
  };
}

export function shouldRetryCategoriesOnProductRetry({
  isCategoriesError,
  isCategoriesFetchedAfterMount,
  isCategoriesFetching,
  isCategoriesLoading,
}: {
  isCategoriesError: boolean;
  isCategoriesFetchedAfterMount: boolean;
  isCategoriesFetching: boolean;
  isCategoriesLoading: boolean;
}): boolean {
  return (
    isCategoriesError &&
    isCategoriesFetchedAfterMount &&
    !isCategoriesLoading &&
    !isCategoriesFetching
  );
}
