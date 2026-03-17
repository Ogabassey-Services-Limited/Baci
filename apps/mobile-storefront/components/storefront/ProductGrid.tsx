import { prioritizeSmartphoneProducts } from '@baci/shared';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { SPACING, TYPOGRAPHY, palette } from '@/constants/Colors';
import { useCategories, useProducts } from '@/hooks/use-products';
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

  const { data: categoriesData = [] } = useCategories();

  const selectedCategoryIdFromFilter = (() => {
    if (selectedCategoryName === 'All') return undefined;
    const cat = (categoriesData as Category[]).find(
      (category) => category.name === selectedCategoryName
    );
    return cat?.id;
  })();

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

  const { products, isLoading, isFetching, refetch } = useProducts({
    limit: fetchLimit,
    category: normalizedCategoryId,
    minPrice: minPrice > 0 ? minPrice : undefined,
    maxPrice: maxPrice < MAX_PRICE_LIMIT ? maxPrice : undefined,
    brand: selectedBrand !== 'All' ? selectedBrand : undefined,
    condition: selectedCondition !== 'All' ? selectedCondition : undefined,
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

  const categoryNames = (() => {
    if (categoriesData.length > 0) {
      const allCats = (categoriesData as Category[]).map((c) => c.name);

      const sorted = allCats.sort((a: string, b: string) => {
        const aName = a.toLowerCase().trim();
        const bName = b.toLowerCase().trim();

        const getPriority = (name: string) => {
          if (
            (name.includes('phone') &&
              !name.includes('headphone') &&
              !name.includes('microphone')) ||
            name.includes('mobile') ||
            name === 'smartphones'
          ) {
            return 1;
          }
          if (
            name.includes('laptop') ||
            name.includes('computer') ||
            name.includes('macbook')
          ) {
            return 2;
          }
          if (name.includes('tablet') || name.includes('ipad')) return 3;
          if (
            name.includes('accessories') ||
            name.includes('watch') ||
            name.includes('audio') ||
            name.includes('headphone')
          ) {
            return 4;
          }
          return 100;
        };

        const aPriority = getPriority(aName);
        const bPriority = getPriority(bName);

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        return a.localeCompare(b);
      });

      return ['All', ...sorted];
    }
    return ['All', 'Phones', 'Gaming', 'Laptops', 'Accessories', 'Printers'];
  })();

  const brands = Array.from(
    new Set(products.map((p) => p.brand).filter(Boolean) as string[])
  );
  const orderedProducts = shouldPrioritizeSmartphones
    ? prioritizeSmartphoneProducts(products).slice(0, displayLimit)
    : products;

  const handlePriceChange = (min: number, max: number) => {
    setMinPrice(min);
    setMaxPrice(max);
  };

  const currentVariant = viewMode === 'list' ? 'list' : variant;

  if (isLoading) return <ProductGridSkeleton count={4} />;

  return (
    <View style={styles.section}>
      {block.props.title && (
        <Text style={styles.sectionTitle}>{block.props.title}</Text>
      )}

      <FilterBar
        categories={categoryNames}
        selectedCategory={selectedCategoryName}
        onSelectCategory={setSelectedCategoryName}
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

      <View
        style={[
          currentVariant === 'list' ? styles.list : styles.grid,
          { opacity: isFetching ? 0.6 : 1 },
        ]}
      >
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
});
