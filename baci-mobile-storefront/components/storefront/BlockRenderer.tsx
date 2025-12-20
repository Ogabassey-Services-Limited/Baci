import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Hero } from './Hero';
import { UtilityPanel } from './UtilityPanel';
import { ProductCard } from './ProductCard';
import { useProducts } from '@/hooks/use-products-query';
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
  const { products, isLoading } = useProducts({ 
    limit: block.props.limit || 12,
    category: selectedCategoryId || undefined 
  });

  if (isLoading) return <ProductGridSkeleton count={4} />;

  return (
    <View style={styles.section}>
      {block.props.title && (
        <Text style={styles.sectionTitle}>{block.props.title}</Text>
      )}
      <View style={variant === 'list' ? styles.list : styles.grid}>
        {products.map((product) => (
          <View key={product.id} style={variant === 'editorial' ? styles.editorialWrapper : variant === 'list' ? styles.listWrapper : styles.gridWrapper}>
            <ProductCard product={product} variant={variant} />
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