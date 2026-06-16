import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { palette } from '@/constants/Colors';
import { PRODUCT_GRID_LOADING_MORE_LABEL } from '@/constants/product-grid';
import { useTheme } from '@/hooks/useTheme';
import type { Product } from '@/types/product';
import { FilterBar } from './FilterBar';
import { ProductCard } from './ProductCard';
import { styles } from './ProductGrid.styles';

interface ProductGridViewProps {
  blockTitle?: string;
  brands: string[];
  categoryNames: string[];
  currentVariant: 'grid' | 'editorial' | 'list';
  isFetching: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isRetrying: boolean;
  maxPrice: number;
  minPrice: number;
  minRating: number;
  onPriceChange: (min: number, max: number) => void;
  onBrandFilterVisible: () => void;
  onRetry: () => void;
  onSelectBrand: (brand: string) => void;
  onSelectCategory: (categoryName: string) => void;
  onSelectCondition: (condition: string) => void;
  onSelectRating: (rating: number) => void;
  onViewModeChange: (mode: 'grid' | 'list') => void;
  selectedBrand: string;
  selectedCategoryName: string;
  selectedCondition: string;
  shouldShowFatalError: boolean;
  shouldShowInitialLoading: boolean;
  uniqueVisibleProducts: Product[];
  viewMode: 'grid' | 'list';
}

export function ProductGridView({
  blockTitle,
  brands,
  categoryNames,
  currentVariant,
  isFetching,
  isLoading,
  isLoadingMore,
  isRetrying,
  maxPrice,
  minPrice,
  minRating,
  onPriceChange,
  onBrandFilterVisible,
  onRetry,
  onSelectBrand,
  onSelectCategory,
  onSelectCondition,
  onSelectRating,
  onViewModeChange,
  selectedBrand,
  selectedCategoryName,
  selectedCondition,
  shouldShowFatalError,
  shouldShowInitialLoading,
  uniqueVisibleProducts,
  viewMode,
}: ProductGridViewProps) {
  const { colors } = useTheme();
  const headerControls = (
    <>
      {blockTitle && (
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {blockTitle}
        </Text>
      )}

      <FilterBar
        categories={categoryNames}
        selectedCategory={selectedCategoryName}
        onSelectCategory={onSelectCategory}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onPriceChange={onPriceChange}
        brands={brands}
        onBrandFilterVisible={onBrandFilterVisible}
        selectedBrand={selectedBrand}
        onSelectBrand={onSelectBrand}
        selectedCondition={selectedCondition}
        onSelectCondition={onSelectCondition}
        minRating={minRating}
        onSelectRating={onSelectRating}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
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
            onPress={onRetry}
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
