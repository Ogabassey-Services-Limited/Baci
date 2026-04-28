import { useEffect, useRef } from 'react';
import { getProductGridCategories } from '@/lib/category-utils';
import type { Category } from '@/hooks';

interface UseProductGridCategoriesArgs {
  normalizedCategories: Category[];
  products: ReadonlyArray<{ category?: string }>;
  isCategoriesLoading: boolean;
  isCategoriesFetching: boolean;
  isCategoriesFetchedAfterMount: boolean;
  isCategoriesError: boolean;
  isProductsLoading: boolean;
  isProductsFetching: boolean;
  isProductsFetchedAfterMount: boolean;
}

interface UseProductGridCategoriesResult {
  categoryNames: string[];
  merchantCategoryNames: string[];
  productCategoryNames: string[];
}

export function useProductGridCategories({
  normalizedCategories,
  products,
  isCategoriesLoading,
  isCategoriesFetching,
  isCategoriesFetchedAfterMount,
  isCategoriesError,
  isProductsLoading,
  isProductsFetching,
  isProductsFetchedAfterMount,
}: UseProductGridCategoriesArgs): UseProductGridCategoriesResult {
  const merchantCategoryNames = normalizedCategories
    .map((category) => category.name?.trim())
    .filter((categoryName): categoryName is string => Boolean(categoryName));
  const productCategoryNames = products
    .map((product) => product.category?.trim())
    .filter((categoryName): categoryName is string => Boolean(categoryName));
  // Strict cascade: merchant categories are canonical when present.
  //
  // Merging product-derived names into a non-empty merchant list would
  // surface chips that don't resolve to a category id — tapping such a chip
  // sets selectedCategorySlug, but resolveSelectedCategoryId() returns
  // undefined AND client-side filtering only runs when
  // normalizedCategories.length === 0, so the grid stays unfiltered while
  // the chip looks active. Falling back to product-derived names only when
  // useCategories() returned nothing keeps the chip set consistent with the
  // resolution logic in ProductGrid.tsx.
  const sourceCategoryNames =
    merchantCategoryNames.length > 0
      ? merchantCategoryNames
      : Array.from(new Set(productCategoryNames));
  const sortedCategories = getProductGridCategories(sourceCategoryNames);
  const categoryNames =
    sortedCategories.length > 0 ? ['All', ...sortedCategories] : ['All'];

  const hasWarnedNoChipsRef = useRef(false);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    const shouldWarn =
      categoryNames.length === 1 &&
      !isCategoriesLoading &&
      !isCategoriesFetching &&
      isCategoriesFetchedAfterMount &&
      !isProductsLoading &&
      !isProductsFetching &&
      isProductsFetchedAfterMount;

    if (!shouldWarn || hasWarnedNoChipsRef.current) {
      return;
    }

    hasWarnedNoChipsRef.current = true;
    console.warn(
      '[ProductGrid] No category chips resolved. Sources empty:',
      JSON.stringify({
        merchantCategoryCount: merchantCategoryNames.length,
        productCategoryCount: productCategoryNames.length,
        productsLoaded: products.length,
        isCategoriesError,
      })
    );
  }, [
    categoryNames.length,
    isCategoriesLoading,
    isCategoriesFetching,
    isCategoriesFetchedAfterMount,
    isProductsLoading,
    isProductsFetching,
    isProductsFetchedAfterMount,
    merchantCategoryNames.length,
    productCategoryNames.length,
    products.length,
    isCategoriesError,
  ]);

  return { categoryNames, merchantCategoryNames, productCategoryNames };
}
