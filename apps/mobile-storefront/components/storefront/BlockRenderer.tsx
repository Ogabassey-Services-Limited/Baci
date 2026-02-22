import type React from 'react';
import { View } from 'react-native';
import { HeroSkeleton } from '@/components/ui/Skeleton';
import { useCategories, useMerchant } from '@/hooks/use-products';
import { CONFIG } from '@/lib/config';
import { getTemplateConfig } from '@/lib/templates';
import type { Block, HeroCarouselBlock } from '@/types/blocks';
import { Hero, type HeroSlide } from './Hero';
import { ProductGrid } from './ProductGrid';
import {
  getFallbackHeroSlides,
  resolveHeroSlides,
  type RawHeroSlide,
} from './hero-slide-utils';
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

    const selectedCategory = (categories as Category[]).find(
      (category) => category.id === selectedCategoryId
    );
    if (selectedCategory) return selectedCategory.name;

    if (selectedCategoryId === 'u-airtime') return 'Airtime';
    if (selectedCategoryId === 'u-data') return 'Data';
    if (selectedCategoryId === 'u-tv') return 'Tv';
    if (selectedCategoryId === 'u-power') return 'Power';
    if (selectedCategoryId === 'u-gaming') return 'Gaming';
    return 'Airtime';
  })();

  const mobileSlides = Array.isArray(merchant?.mobile_hero_slides)
    ? (merchant.mobile_hero_slides as RawHeroSlide[])
    : null;

  const renderHeroBlock = (blockId: string, autoplayDelay?: number) => {
    const slides = resolveHeroSlides(null, mobileSlides, true);
    const safeSlides: HeroSlide[] =
      slides.length > 0
        ? slides
        : getFallbackHeroSlides(merchant?.business_name);

    return (
      <Hero key={blockId} slides={safeSlides} autoplayDelay={autoplayDelay} />
    );
  };

  return (
    <View>
      {(blocks || []).map((block, index) => {
        switch (block.type) {
          case 'HeroCarousel': {
            const hasMobileSlides =
              Array.isArray(mobileSlides) && mobileSlides.length > 0;

            if (isMerchantLoading && !hasMobileSlides) {
              return <HeroSkeleton key={block.props.id} />;
            }

            const heroBlock = block as HeroCarouselBlock;
            return renderHeroBlock(block.props.id, heroBlock.props.autoplayDelay);
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
                block={block}
                selectedCategoryId={selectedCategoryId}
                variant={template.cardVariant}
              />
            );
          default: {
            const maybeHeroBlock = block as Block & {
              type: string;
              props: {
                id?: string;
                slides?: unknown;
                autoplayDelay?: unknown;
              };
            };

            if (/hero$/i.test(maybeHeroBlock.type)) {
              const id =
                maybeHeroBlock.props.id || `hero-fallback-${String(index)}`;
              const autoplayDelay =
                typeof maybeHeroBlock.props.autoplayDelay === 'number'
                  ? maybeHeroBlock.props.autoplayDelay
                  : undefined;
              return renderHeroBlock(id, autoplayDelay);
            }

            return null;
          }
        }
      })}
    </View>
  );
};
