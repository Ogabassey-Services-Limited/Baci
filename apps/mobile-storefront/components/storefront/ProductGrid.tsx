import { prioritizeSmartphoneProducts } from '@baci/shared';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { palette, SPACING, TYPOGRAPHY } from '@/constants/Colors';
import { useCategories, useProductBrands, useProducts } from '@/hooks';
import { getProductGridCategories } from '@/lib/category-utils';
import { resolveSelectedCategoryId } from '@/lib/product-filter-options';
import type { ProductGridBlock } from '@/types/blocks';
import { FilterBar } from './FilterBar';
import { ProductCard } from './ProductCard';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface ProductGridProps {
  block: ProductGridBlock;
  selectedCategoryId: string | null;
  variant: 'grid' | 'editorial' | 'list';
}

const MAX_PRICE_LIMIT = 3000000;

export default function ProductGrid({
  block,
  selectedCategoryId,
  variant,
}: ProductGridProps) {
  const [selectedCategoryName, setSelectedCategoryName] = useState('All');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE_LIMIT);
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [minRating, setMinRating] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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

  const { products, isLoading, isFetching, isError, refetch } = useProducts({
    limit: fetchLimit,
    category: normalizedCategoryId,
    minPrice: minPrice > 0 ? minPrice : undefined,
    maxPrice: maxPrice < MAX_PRICE_LIMIT ? maxPrice : undefined,
    brand: selectedBrand !== 'All' ? selectedBrand : undefined,
    condition: selectedCondition !== 'All' ? selectedCondition : undefined,
    minRating: minRating > 0 ? minRating : undefined,
  });
  const { brands = [] } = useProductBrands({
    category: normalizedCategoryId,
    minPrice: minPrice > 0 ? minPrice : undefined,
    maxPrice: maxPrice < MAX_PRICE_LIMIT ? maxPrice : undefined,
    condition: selectedCondition !== 'All' ? selectedCondition : undefined,
    minRating: minRating > 0 ? minRating : undefined,
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
  }, [brands, selectedBrand]);

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
    ? prioritizeSmartphoneProducts(products).slice(0, displayLimit)
    : products;

  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategoryName(categoryName);
    setMinPrice(0);
    setMaxPrice(MAX_PRICE_LIMIT);
    setSelectedBrand('All');
    setSelectedCondition('All');
    setMinRating(0);
  };

  const handlePriceChange = (min: number, max: number) => {
    setMinPrice(min);
    setMaxPrice(max);
  };

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
        {orderedProducts.length === 0 && !isFetching ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: palette.gray[400] }]}>
              No products match your criteria.
            </Text>
          </View>
        ) : (
          orderedProducts.map((product) => (
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
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingVertical: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: 'Inter_700Bold',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  list: {
    flexDirection: 'column',
  },
  gridWrapper: {
    width: '50%',
    paddingHorizontal: 8,
  },
  editorialWrapper: {
    width: '100%',
  },
  listWrapper: {
    width: '100%',
  },
  emptyState: {
    width: '100%',
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.gray[300],
  },
  retryButtonText: {
    color: palette.gray[700],
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
});
