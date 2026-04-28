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
  const mergedCategoryNames = Array.from(
    new Set([...merchantCategoryNames, ...productCategoryNames])
  );
  const sortedCategories = getProductGridCategories(mergedCategoryNames);
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
