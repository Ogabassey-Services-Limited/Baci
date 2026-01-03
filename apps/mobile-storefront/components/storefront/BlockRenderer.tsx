import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Hero } from './Hero';
import { UtilityPanel } from './UtilityPanel';
import { ProductCard } from './ProductCard';
import { FilterBar } from './FilterBar';
import { useProducts, useCategories } from '@/hooks/use-products-query';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { SPACING, TYPOGRAPHY } from '@/constants/Colors';
import { CONFIG } from '@/lib/config';
import { getTemplateConfig } from '@/lib/templates';
import type { Block, ProductGridBlock, HeroCarouselBlock } from '@/types/blocks';

interface BlockRendererProps {
  blocks: Block[];
  selectedCategoryId: string | null;
  onCategorySelect: (id: string | null) => void;
}

const ProductGrid = ({ block, selectedCategoryId, variant }: {
  block: ProductGridBlock,
  selectedCategoryId: string | null,
  variant: 'grid' | 'editorial' | 'list'
}) => {
  // Filter state
  const [selectedCategoryName, setSelectedCategoryName] = useState('All');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(3000000);
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [minRating, setMinRating] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: categoriesData = [] } = useCategories();

  // Map category name to ID for API query
  const selectedCategoryIdFromFilter = useMemo(() => {
    if (selectedCategoryName === 'All') return undefined;
    const cat = categoriesData.find((c: any) => c.name === selectedCategoryName);
    return cat?.id;
  }, [selectedCategoryName, categoriesData]);

  const { products, isLoading } = useProducts({
    limit: block.props.limit || 12,
    category: selectedCategoryIdFromFilter || selectedCategoryId || undefined,
    minPrice: minPrice > 0 ? minPrice : undefined,
    maxPrice: maxPrice < 3000000 ? maxPrice : undefined,
    brand: selectedBrand !== 'All' ? selectedBrand : undefined,
    condition: selectedCondition !== 'All' ? selectedCondition : undefined,
  });

  // Derive categories and brands from data
  const categoryNames = useMemo(() => {
    if (categoriesData.length > 0) {
      return ['All', ...categoriesData.map((c: any) => c.name)];
    }
    return ['All', 'Phones', 'Gaming', 'Laptops', 'Accessories', 'Printers'];
  }, [categoriesData]);

  const brands = useMemo(() => {
    return Array.from(new Set(products.map(p => p.brand).filter(Boolean) as string[]));
  }, [products]);

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

      {/* Filter Bar - matching web mobile view */}
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

      <View style={currentVariant === 'list' ? styles.list : styles.grid}>
        {products.map((product) => (
          <View key={product.id} style={currentVariant === 'editorial' ? styles.editorialWrapper : currentVariant === 'list' ? styles.listWrapper : styles.gridWrapper}>
            <ProductCard product={product} variant={currentVariant} />
          </View>
        ))}
      </View>
    </View>
  );
};

export const BlockRenderer: React.FC<BlockRendererProps> = ({ 
  blocks, 
  selectedCategoryId, 
  onCategorySelect 
}) => {
  const template = getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID);

  return (
    <View>
      {blocks.map((block) => {
        switch (block.type) {
          case 'HeroCarousel':
            return (
              <Hero 
                key={block.props.id} 
                slides={(block as HeroCarouselBlock).props.slides} 
                autoplayDelay={(block as HeroCarouselBlock).props.autoplayDelay}
              />
            );
          case 'CategoryRail':
            return (
              <UtilityPanel 
                key={block.props.id}
                variant={template.categoryStyle}
                selectedCategoryId={selectedCategoryId}
                onCategorySelect={onCategorySelect}
              />
            );
          case 'ProductGrid':
            return (
              <ProductGrid 
                key={block.props.id} 
                block={block as ProductGridBlock} 
                selectedCategoryId={selectedCategoryId}
                variant={template.cardVariant}
              />
            );
          default:
            return null;
        }
      })}
    </View>
  );
};

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
});