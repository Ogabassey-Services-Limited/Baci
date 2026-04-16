import { prioritizeSmartphoneProducts } from '@baci/shared';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { palette } from '@/constants/Colors';
import { useCategories, useProductBrands, useProducts } from '@/hooks';
import { getProductGridCategories } from '@/lib/category-utils';
import { resolveSelectedCategoryId } from '@/lib/product-filter-options';
import type { ProductGridBlock } from '@/types/blocks';
import { FilterBar } from './FilterBar';
import { ProductCard } from './ProductCard';
import { styles } from './ProductGrid.styles';
import {
  PRODUCT_GRID_LOADING_MORE_LABEL,
  PRODUCT_GRID_MAX_PRICE_LIMIT,
} from './product-grid.constants';
import { useProductGridFilters } from './use-product-grid-filters';
import { useProductGridPagination } from './use-product-grid-pagination';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

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
    selectedCategoryName,
    selectedCondition,
    setMinRating,
    setSelectedBrand,
    setSelectedCondition,
    setViewMode,
    viewMode,
  } = useProductGridFilters();
  const {
    data: categoriesData = [],
    isLoading: isCategoriesLoading,
    isError: isCategoriesError,
  } = useCategories();

  const selectedCategoryIdFromFilter = resolveSelectedCategoryId(
    selectedCategoryName,
    categoriesData as Category[]
  );

  const normalizedCategoryId = (() => {
    const id = selectedCategoryIdFromFilter;
    if (id) return id;

    if (selectedCategoryId && !selectedCategoryId.startsWith('u-')) {
      return selectedCategoryId;
    }

    return undefined;
  })();
  const displayLimit = block.props.limit ?? 12;
  const shouldPrioritizeSmartphones =
    !selectedCategoryIdFromFilter && !normalizedCategoryId;
  const fetchLimit = shouldPrioritizeSmartphones
    ? displayLimit * 4
    : displayLimit;
  const isFocused = useIsFocused();
  const hasFocusedOnceRef = useRef(false);

  const {
    products,
    hasMore,
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
    selectedCategoryName,
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

  const categoryNames = (() => {
    if (categoriesData.length > 0) {
      const allCats = (categoriesData as Category[]).map(
        (category) => category.name
      );
      const sorted = getProductGridCategories(allCats);

      return ['All', ...sorted];
    }
    return ['All', 'Phones', 'Gaming', 'Laptops', 'Accessories', 'Printers'];
  })();

  const orderedProducts = shouldPrioritizeSmartphones
    ? prioritizeSmartphoneProducts(products)
    : products;
  const { visibleProducts } = useProductGridPagination({
    displayLimit,
    hasMore,
    isLoadingMore,
    loadMore,
    loadMoreSignal,
    orderedProducts,
    paginationResetKey,
  });

  const currentVariant = viewMode === 'list' ? 'list' : variant;

  if ((isCategoriesError && !isCategoriesLoading) || (isError && !isLoading)) {
    return (
      <View style={styles.section}>
        {block.props.title && (
          <Text style={styles.sectionTitle}>{block.props.title}</Text>
        )}
        <View style={styles.emptyState} testID="product-grid-error">
          <Text style={[styles.emptyText, { color: palette.gray[400] }]}>
            Failed to load products. Please try again.
          </Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void refetch()}
            disabled={isFetching}
          >
            <Text style={styles.retryButtonText}>
              {isFetching ? 'Retrying...' : 'Try Again'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isLoading) return <ProductGridSkeleton count={4} />;

  return (
    <View style={styles.section}>
      {block.props.title && (
        <Text style={styles.sectionTitle}>{block.props.title}</Text>
      )}

      <FilterBar
        categories={categoryNames}
        selectedCategory={selectedCategoryName}
        onSelectCategory={handleCategorySelect}
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

      <View style={currentVariant === 'list' ? styles.list : styles.grid}>
        {visibleProducts.length === 0 && !isFetching ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: palette.gray[400] }]}>
              No products match your criteria.
            </Text>
          </View>
        ) : (
          visibleProducts.map((product) => (
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
