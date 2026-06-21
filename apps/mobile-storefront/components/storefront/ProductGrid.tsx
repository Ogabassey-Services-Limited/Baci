import { dedupeById } from '@baci/shared/lib';
import { useEffect, useState } from 'react';
import { PRODUCT_GRID_MAX_PRICE_LIMIT } from '@/constants/product-grid';
import {
  type Category,
  useCategories,
  useProductBrands,
  useProducts,
} from '@/hooks';
import {
  ALL_PRODUCT_FILTER_CATEGORY_SLUG,
  normalizeSelectedCategorySlug,
  resolveSelectedCategoryId,
} from '@/lib/product-filter-options';
import type { ProductGridBlock } from '@/types/blocks';
import { ProductGridView } from './ProductGridView';
import {
  filterProductsByClientCategory,
  resolveNormalizedCategoryId,
  resolveProductGridRenderFlags,
  resolveSelectedCategoryName,
  shouldRetryCategoriesOnProductRetry,
} from './product-grid.helpers';
import { useProductGridCategories } from './use-product-grid-categories';
import { useProductGridFilters } from './use-product-grid-filters';

interface ProductGridProps {
  block: ProductGridBlock;
  selectedCategoryId: string | null;
  variant: 'grid' | 'editorial' | 'list';
}

/**
 * Renders a **bounded** (non-paginating) product grid for non-primary/curated
 * home blocks. The primary, infinitely-scrolled home grid is virtualized by
 * `HomeFeedList` instead; this container is capped at `displayLimit`.
 */
export default function ProductGrid({
  block,
  selectedCategoryId,
  variant,
}: ProductGridProps) {
  const {
    handleCategorySelect,
    handlePriceChange,
    maxPrice,
    minPrice,
    minRating,
    selectedBrand,
    selectedCategorySlug,
    selectedCondition,
    setMinRating,
    setSelectedBrand,
    setSelectedCondition,
    setViewMode,
    viewMode,
  } = useProductGridFilters();
  const [brandOptionsRequested, setBrandOptionsRequested] = useState(false);
  const {
    data: categoriesData = [],
    isFetchedAfterMount: isCategoriesFetchedAfterMount,
    isFetching: isCategoriesFetching,
    isLoading: isCategoriesLoading,
    isError: isCategoriesError,
    refetch: refetchCategories,
  } = useCategories();
  const normalizedCategories: Category[] = categoriesData;

  const selectedCategoryIdFromFilter = resolveSelectedCategoryId(
    selectedCategorySlug,
    normalizedCategories
  );

  const normalizedCategoryId = resolveNormalizedCategoryId({
    selectedCategoryId,
    selectedCategoryIdFromFilter,
    selectedCategorySlug,
  });
  const displayLimit = block.props.limit ?? 12;
  const fetchLimit = displayLimit;

  const {
    products,
    isFetchedAfterMount,
    isLoading,
    isLoadingMore,
    isFetching,
    isError,
    hasMore,
    loadMore,
    refetch,
  } = useProducts({
    limit: fetchLimit,
    category: normalizedCategoryId,
    minPrice: minPrice > 0 ? minPrice : undefined,
    maxPrice: maxPrice < PRODUCT_GRID_MAX_PRICE_LIMIT ? maxPrice : undefined,
    brand: selectedBrand !== 'All' ? selectedBrand : undefined,
    condition: selectedCondition !== 'All' ? selectedCondition : undefined,
    minRating: minRating > 0 ? minRating : undefined,
  });
  const { categoryNames } = useProductGridCategories({
    normalizedCategories,
    products,
    isCategoriesLoading,
    isCategoriesFetching,
    isCategoriesFetchedAfterMount,
    isCategoriesError,
    isProductsLoading: isLoading,
    isProductsFetching: isFetching,
    isProductsFetchedAfterMount: isFetchedAfterMount,
  });
  const { matchedCategoryName, selectedCategoryName } =
    resolveSelectedCategoryName({
      categoryNames,
      normalizedCategories,
      selectedCategorySlug,
    });

  if (
    __DEV__ &&
    !matchedCategoryName &&
    selectedCategorySlug !== ALL_PRODUCT_FILTER_CATEGORY_SLUG
  ) {
    console.warn(
      `[ProductGrid] selectedCategorySlug "${selectedCategorySlug}" does not map to any known category; chip UI will show "All" while product query remains filtered by the stale slug.`
    );
  }

  const filteredProducts = filterProductsByClientCategory({
    normalizedCategories,
    products,
    selectedCategorySlug,
  });
  const uniqueFilteredProducts = dedupeById(filteredProducts);
  const isClientCategoryFilterActive =
    normalizedCategories.length === 0 &&
    selectedCategorySlug !== ALL_PRODUCT_FILTER_CATEGORY_SLUG &&
    selectedCategorySlug.length > 0;
  const shouldLoadBrandOptions =
    brandOptionsRequested || selectedBrand !== 'All';
  const { brands = [], isLoading: isBrandsLoading } = useProductBrands({
    category: normalizedCategoryId,
    enabled: shouldLoadBrandOptions,
    minPrice: minPrice > 0 ? minPrice : undefined,
    maxPrice: maxPrice < PRODUCT_GRID_MAX_PRICE_LIMIT ? maxPrice : undefined,
    condition: selectedCondition !== 'All' ? selectedCondition : undefined,
    minRating: minRating > 0 ? minRating : undefined,
  });
  useEffect(() => {
    if (
      shouldLoadBrandOptions &&
      !isBrandsLoading &&
      selectedBrand !== 'All' &&
      !brands.includes(selectedBrand)
    ) {
      setSelectedBrand('All');
    }
  }, [
    brands,
    isBrandsLoading,
    selectedBrand,
    setSelectedBrand,
    shouldLoadBrandOptions,
  ]);

  const handleCategoryChipSelect = (categoryName: string) => {
    handleCategorySelect(
      normalizeSelectedCategorySlug(categoryName, normalizedCategories)
    );
  };

  useEffect(() => {
    if (
      isClientCategoryFilterActive &&
      uniqueFilteredProducts.length < displayLimit &&
      hasMore &&
      !isFetching &&
      !isLoadingMore
    ) {
      loadMore();
    }
  }, [
    displayLimit,
    hasMore,
    isClientCategoryFilterActive,
    isFetching,
    isLoadingMore,
    loadMore,
    uniqueFilteredProducts.length,
  ]);

  // Bounded: cap a curated/secondary grid at displayLimit, but backfill
  // client-filtered pages first when category IDs are unavailable.
  const uniqueVisibleProducts = uniqueFilteredProducts.slice(0, displayLimit);
  const currentVariant = viewMode === 'list' ? 'list' : variant;
  const { isRetrying, shouldShowFatalError, shouldShowInitialLoading } =
    resolveProductGridRenderFlags({
      isCategoriesError,
      isCategoriesFetching,
      isError,
      isFetchedAfterMount,
      isLoading,
      productsLength: products.length,
      uniqueVisibleProductsLength: uniqueVisibleProducts.length,
    });
  const handleRetry = () => {
    void refetch();

    if (
      shouldRetryCategoriesOnProductRetry({
        isCategoriesError,
        isCategoriesFetchedAfterMount,
        isCategoriesFetching,
        isCategoriesLoading,
      })
    ) {
      void refetchCategories();
    }
  };
  const isProductRetrying = isFetching || isRetrying;
  return (
    <ProductGridView
      blockTitle={block.props.title}
      brands={brands}
      categoryNames={categoryNames}
      currentVariant={currentVariant}
      isFetching={isFetching}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      isRetrying={isProductRetrying}
      maxPrice={maxPrice}
      minPrice={minPrice}
      minRating={minRating}
      onPriceChange={handlePriceChange}
      onBrandFilterVisible={() => setBrandOptionsRequested(true)}
      onRetry={handleRetry}
      onSelectBrand={setSelectedBrand}
      onSelectCategory={handleCategoryChipSelect}
      onSelectCondition={setSelectedCondition}
      onSelectRating={setMinRating}
      onViewModeChange={setViewMode}
      selectedBrand={selectedBrand}
      selectedCategoryName={selectedCategoryName}
      selectedCondition={selectedCondition}
      shouldShowFatalError={shouldShowFatalError}
      shouldShowInitialLoading={shouldShowInitialLoading}
      uniqueVisibleProducts={uniqueVisibleProducts}
      viewMode={viewMode}
    />
  );
}
