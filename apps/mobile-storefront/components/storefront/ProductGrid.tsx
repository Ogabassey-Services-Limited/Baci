import { prioritizeSmartphoneProducts } from '@baci/shared';
import { dedupeById } from '@baci/shared/lib';
import { useIsFocused } from "expo-router/react-navigation";
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { palette } from '@/constants/Colors';
import {
  PRODUCT_GRID_LOADING_MORE_LABEL,
  PRODUCT_GRID_MAX_PRICE_LIMIT,
} from '@/constants/product-grid';
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
import { FilterBar } from './FilterBar';
import { ProductCard } from './ProductCard';
import { styles } from './ProductGrid.styles';
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

  const normalizedCategoryId = (() => {
    if (selectedCategoryIdFromFilter) {
      return selectedCategoryIdFromFilter;
    }

    // Only fall back to parent selectedCategoryId when 'All' is active
    if (
      selectedCategorySlug === ALL_PRODUCT_FILTER_CATEGORY_SLUG &&
      selectedCategoryId &&
      !selectedCategoryId.startsWith('u-')
    ) {
      return selectedCategoryId;
    }

    return undefined;
  })();
  const displayLimit = block.props.limit ?? 12;
  const shouldPrioritizeSmartphones =
    !selectedCategoryIdFromFilter &&
    !normalizedCategoryId &&
    selectedCategorySlug === ALL_PRODUCT_FILTER_CATEGORY_SLUG;
  const fetchLimit = shouldPrioritizeSmartphones
    ? displayLimit * 4
    : displayLimit;
  const isFocused = useIsFocused();
  const hasFocusedOnceRef = useRef(false);

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
  const selectedCategoryName = matchedCategoryName ?? 'All';

  if (
    __DEV__ &&
    !matchedCategoryName &&
    selectedCategorySlug !== ALL_PRODUCT_FILTER_CATEGORY_SLUG
  ) {
    console.warn(
      `[ProductGrid] selectedCategorySlug "${selectedCategorySlug}" does not map to any known category; chip UI will show "All" while product query remains filtered by the stale slug.`
    );
  }

  const selectedClientSideCategorySlug =
    normalizedCategories.length === 0 &&
    selectedCategorySlug !== ALL_PRODUCT_FILTER_CATEGORY_SLUG
      ? selectedCategorySlug
      : null;
  const shouldFilterProductsClientSide =
    selectedClientSideCategorySlug !== null &&
    selectedClientSideCategorySlug.length > 0;
  const filteredProducts = shouldFilterProductsClientSide
    ? products.filter((product) => {
        const productCategory = product.category?.trim();

        if (!productCategory) {
          return false;
        }

        return (
          normalizeSelectedCategorySlug(
            productCategory,
            normalizedCategories
          ) === selectedClientSideCategorySlug
        );
      })
    : products;
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
    if (!isFocused) {
      return;
    }

    if (!hasFocusedOnceRef.current) {
      hasFocusedOnceRef.current = true;
      return;
    }

    void refetch();
  }, [isFocused, refetch]);

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
  const hasRenderableProducts =
    uniqueVisibleProducts.length > 0 || products.length > 0;
  const shouldShowFatalError =
    isError && isFetchedAfterMount && !isLoading && !hasRenderableProducts;
  const shouldShowInitialLoading =
    !hasRenderableProducts && !isFetchedAfterMount;
  const handleRetry = () => {
    void refetch();

    if (
      isCategoriesError &&
      isCategoriesFetchedAfterMount &&
      !isCategoriesLoading &&
      !isCategoriesFetching
    ) {
      void refetchCategories();
    }
  };
  const isRetrying = isFetching || (isCategoriesError && isCategoriesFetching);
  const headerControls = (
    <>
      {block.props.title && (
        <Text style={styles.sectionTitle}>{block.props.title}</Text>
      )}

      <FilterBar
        categories={categoryNames}
        selectedCategory={selectedCategoryName}
        onSelectCategory={handleCategoryChipSelect}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onPriceChange={handlePriceChange}
        brands={brands}
        selectedBrand={selectedBrand}
        onSelectBrand={setSelectedBrand}
        selectedCondition={selectedCondition}
        onSelectCondition={setSelectedCondition}
        minRating={minRating}
        onSelectRating={setMinRating}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
    </>
  );

  if (shouldShowFatalError) {
    return (
      <View style={styles.section}>
        {headerControls}
        <View style={styles.emptyState} testID="product-grid-error">
          <Text style={[styles.emptyText, { color: palette.gray[400] }]}>
            Failed to load products. Please try again.
          </Text>
          <Pressable
            style={styles.retryButton}
            onPress={handleRetry}
            disabled={isRetrying}
            accessibilityRole="button"
            accessibilityLabel={
              isRetrying
                ? 'Retrying to load products'
                : 'Retry loading products'
            }
          >
            <Text style={styles.retryButtonText}>
              {isRetrying ? 'Retrying...' : 'Try Again'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isLoading || shouldShowInitialLoading) {
    return (
      <View style={styles.section}>
        {headerControls}
        <ProductGridSkeleton count={4} />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {headerControls}

      <View style={currentVariant === 'list' ? styles.list : styles.grid}>
        {uniqueVisibleProducts.length === 0 && !isFetching ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: palette.gray[400] }]}>
              No products match your criteria.
            </Text>
          </View>
        ) : (
          uniqueVisibleProducts.map((product) => (
            <View
              key={product.id}
              style={
                currentVariant === 'editorial'
                  ? styles.editorialWrapper
                  : currentVariant === 'list'
                    ? styles.listWrapper
                    : styles.gridWrapper
              }
            >
              <ProductCard product={product} variant={currentVariant} />
            </View>
          ))
        )}
      </View>
      {isLoadingMore ? (
        <View
          style={styles.loadingMore}
          accessible
          accessibilityLabel={PRODUCT_GRID_LOADING_MORE_LABEL}
          accessibilityRole="progressbar"
        >
          <ActivityIndicator
            size="small"
            color={palette.gray[400]}
            accessibilityElementsHidden
          />
        </View>
      ) : null}
    </View>
  );
}
