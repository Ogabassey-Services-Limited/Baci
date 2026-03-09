import { prioritizeSmartphoneProducts } from '@baci/shared';
import type React from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HeroSkeleton, ProductGridSkeleton } from '@/components/ui/Skeleton';
import { SPACING, TYPOGRAPHY } from '@/constants/Colors';
import { useCategories, useMerchant, useProducts } from '@/hooks/use-products';
import { CONFIG } from '@/lib/config';
import { getTemplateConfig } from '@/lib/templates';
import type {
  Block,
  HeroCarouselBlock,
  ProductGridBlock,
} from '@/types/blocks';
import { FilterBar } from './FilterBar';
import { Hero, type HeroSlide } from './Hero';
import { ProductCard } from './ProductCard';
import { UtilityPanel } from './UtilityPanel';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface BlockRendererProps {
  blocks: Block[];
  selectedCategoryId: string | null;
  onCategorySelect: (id: string | null) => void;
}

const ProductGrid = ({
  block,
  selectedCategoryId,
  variant,
}: {
  block: ProductGridBlock;
  selectedCategoryId: string | null;
  variant: 'grid' | 'editorial' | 'list';
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
  const selectedCategoryIdFromFilter = (() => {
    if (selectedCategoryName === 'All') return undefined;
    const cat = (categoriesData as Category[]).find(
      (c) => c.name === selectedCategoryName
    );
    return cat?.id;
  })();

  // 2026 Best Practice: Normalize category IDs
  const normalizedCategoryId = (() => {
    const id = selectedCategoryIdFromFilter; // Priority to internal grid filters
    if (id) return id;

    // Fallback to global category if it's NOT a fintech utility
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

  const { products, isLoading, isFetching } = useProducts({
    limit: fetchLimit,
    category: normalizedCategoryId,
    minPrice: minPrice > 0 ? minPrice : undefined,
    maxPrice: maxPrice < 3000000 ? maxPrice : undefined,
    brand: selectedBrand !== 'All' ? selectedBrand : undefined,
    condition: selectedCondition !== 'All' ? selectedCondition : undefined,
  });

  // Derive categories and brands from data
  const categoryNames = (() => {
    if (categoriesData.length > 0) {
      const allCats = (categoriesData as Category[]).map((c) => c.name);

      const sorted = allCats.sort((a: string, b: string) => {
        const aName = a.toLowerCase().trim();
        const bName = b.toLowerCase().trim();

        // Helper for priority checking
        const getPriority = (name: string) => {
          // Priority 1: Mobile Phones / Smartphones (Excluding accessories like headphones)
          if (
            (name.includes('phone') &&
              !name.includes('headphone') &&
              !name.includes('microphone')) ||
            name.includes('mobile') ||
            name === 'smartphones'
          ) {
            return 1;
          }
          // Priority 2: Computing
          if (
            name.includes('laptop') ||
            name.includes('computer') ||
            name.includes('macbook')
          )
            return 2;
          // Priority 3: Tablets
          if (name.includes('tablet') || name.includes('ipad')) return 3;
          // Priority 4: Accessories & Audio
          if (
            name.includes('accessories') ||
            name.includes('watch') ||
            name.includes('audio') ||
            name.includes('headphone')
          )
            return 4;
          return 100;
        };

        const accPriority = getPriority(aName);
        const bccPriority = getPriority(bName);

        if (accPriority !== bccPriority) {
          return accPriority - bccPriority;
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

      <View
        style={[
          currentVariant === 'list' ? styles.list : styles.grid,
          { opacity: isFetching ? 0.6 : 1 }, // Visual feedback for background updates
        ]}
      >
        {orderedProducts.length === 0 && !isFetching ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: '#9CA3AF' }]}>
              No products found matches your criteria.
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
};

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  blocks,
  selectedCategoryId,
  onCategorySelect,
}) => {
  const template = getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID);
  const { data: categories = [] } = useCategories();
  const { data: merchant, isLoading: isMerchantLoading } = useMerchant();

  const selectedCategoryName = (() => {
    if (!selectedCategoryId) return 'Airtime';
    // Check remote categories
    const cat = (categories as Category[]).find(
      (c) => c.id === selectedCategoryId
    );
    if (cat) return cat.name;
    // Check hardcoded utility IDs
    if (selectedCategoryId === 'u-airtime') return 'Airtime';
    if (selectedCategoryId === 'u-data') return 'Data';
    if (selectedCategoryId === 'u-tv') return 'Tv';
    if (selectedCategoryId === 'u-power') return 'Power';
    if (selectedCategoryId === 'u-gaming') return 'Gaming';
    return 'Airtime';
  })();

  return (
    <View>
      {(blocks || []).map((block) => {
        switch (block.type) {
          case 'HeroCarousel': {
            if (isMerchantLoading) {
              return <HeroSkeleton key={block.props.id} />;
            }

            const heroBlock = block as HeroCarouselBlock;
            const mobileSlides = merchant?.hero_slides;

            const slides =
              mobileSlides && mobileSlides.length > 0
                ? mobileSlides.map((s: Record<string, string>) => ({
                    title: s.headline || s.title || '',
                    subtitle: s.description || s.subtitle || '',
                    image: s.imageUrl || s.image || '',
                    ctaText: s.cta || s.ctaText || 'Shop Now',
                    ctaLink: s.link || s.ctaLink || '/category/all',
                  }))
                : null;

            if (!slides || slides.length === 0) return null;

            return (
              <Hero
                key={block.props.id}
                slides={slides as HeroSlide[]}
                autoplayDelay={heroBlock.props.autoplayDelay}
              />
            );
          }
          case 'CategoryRail':
            return (
              <UtilityPanel
                key={block.props.id}
                variant={template.categoryStyle}
                selectedCategoryId={selectedCategoryId}
                onCategorySelect={onCategorySelect}
                selectedCategoryName={selectedCategoryName}
                slug={
                  (block as Block & { props: { slug?: string } }).props.slug
                }
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
