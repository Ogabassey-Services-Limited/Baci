import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { SPACING, TYPOGRAPHY } from '@/constants/Colors';
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

export function ProductGrid({
  block,
  selectedCategoryId,
  variant,
}: ProductGridProps) {
  const [selectedCategoryName, setSelectedCategoryName] = useState('All');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(3000000);
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [minRating, setMinRating] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: categoriesData = [] } = useCategories();

  const selectedCategoryIdFromFilter = (() => {
    if (selectedCategoryName === 'All') return undefined;
    const selectedCategory = (categoriesData as Category[]).find(
      (category) => category.name === selectedCategoryName
    );
    return selectedCategory?.id;
  })();

  const normalizedCategoryId = (() => {
    const id = selectedCategoryIdFromFilter;
    if (id) return id;

    if (selectedCategoryId && !selectedCategoryId.startsWith('u-')) {
      return selectedCategoryId;
    }

    return undefined;
  })();

  const { products, isLoading, isFetching } = useProducts({
    limit: block.props.limit || 12,
    category: normalizedCategoryId,
    minPrice: minPrice > 0 ? minPrice : undefined,
    maxPrice: maxPrice < 3000000 ? maxPrice : undefined,
    brand: selectedBrand !== 'All' ? selectedBrand : undefined,
    condition: selectedCondition !== 'All' ? selectedCondition : undefined,
  });

  const categoryNames = (() => {
    if (categoriesData.length > 0) {
      const allCategories = (categoriesData as Category[]).map(
        (category) => category.name
      );

      const sorted = allCategories.sort((a: string, b: string) => {
        const normalizedA = a.toLowerCase().trim();
        const normalizedB = b.toLowerCase().trim();

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

        const priorityA = getPriority(normalizedA);
        const priorityB = getPriority(normalizedB);

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        return a.localeCompare(b);
      });

      return ['All', ...sorted];
    }

    return ['All', 'Phones', 'Gaming', 'Laptops', 'Accessories', 'Printers'];
  })();

  const brands = Array.from(
    new Set(products.map((product) => product.brand).filter(Boolean) as string[])
  );

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
        {products.length === 0 && !isFetching ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: '#9CA3AF' }]}>
              No products found matches your criteria.
            </Text>
          </View>
        ) : (
          products.map((product) => (
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
