import { prioritizeSmartphoneProducts } from '@baci/shared';
import { dedupeById } from '@baci/shared/lib';
import { useEffect } from 'react';
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
import { useProductGridPagination } from './use-product-grid-pagination';

interface ProductGridProps {
  block: ProductGridBlock;
  loadMoreSignal?: number;
  selectedCategoryId: string | null;
  variant: 'grid' | 'editorial' | 'list';
}

export default function ProductGrid({
  block,
  loadMoreSignal = 0,
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
  const shouldPrioritizeSmartphones =
    !selectedCategoryIdFromFilter &&
    !normalizedCategoryId &&
    selectedCategorySlug === ALL_PRODUCT_FILTER_CATEGORY_SLUG;
  const fetchLimit = shouldPrioritizeSmartphones
    ? displayLimit * 4
    : displayLimit;

  const {
    products,
    hasMore,
    isFetchedAfterMount,
    isLoading,
    isLoadingMore,
    isFetching,
    isError,
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
  const { brands = [] } = useProductBrands({
    category: normalizedCategoryId,
    minPrice: minPrice > 0 ? minPrice : undefined,
    maxPrice: maxPrice < PRODUCT_GRID_MAX_PRICE_LIMIT ? maxPrice : undefined,
    condition: selectedCondition !== 'All' ? selectedCondition : undefined,
    minRating: minRating > 0 ? minRating : undefined,
  });
  const paginationResetKey = JSON.stringify({
    category: normalizedCategoryId ?? null,
    displayLimit,
    maxPrice,
    minPrice,
    minRating,
    selectedBrand,
    selectedCategorySlug,
    selectedCondition,
  });

  useEffect(() => {
    if (selectedBrand !== 'All' && !brands.includes(selectedBrand)) {
      setSelectedBrand('All');
    }
  }, [brands, selectedBrand, setSelectedBrand]);

  const handleCategoryChipSelect = (categoryName: string) => {
    handleCategorySelect(
      normalizeSelectedCategorySlug(categoryName, normalizedCategories)
    );
  };

  const orderedProducts = shouldPrioritizeSmartphones
    ? prioritizeSmartphoneProducts(filteredProducts)
    : filteredProducts;
  const { visibleProducts } = useProductGridPagination({
    displayLimit,
    hasMore,
    isLoadingMore,
    loadMore,
    loadMoreSignal,
    orderedProducts,
    paginationResetKey,
  });
  const uniqueVisibleProducts = dedupeById(visibleProducts);
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
