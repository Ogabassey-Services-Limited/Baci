import type React from 'react';
import { View } from 'react-native';
import { HeroSkeleton } from '@/components/ui/Skeleton';
import { useCategories } from '@/hooks';
import { CONFIG } from '@/lib/config';
import { getTemplateConfig } from '@/lib/templates';
import type {
  Block,
  HeroCarouselBlock,
  ProductGridBlock,
} from '@/types/blocks';
import { Hero, type HeroSlide } from './Hero';
import ProductGrid from './ProductGrid';
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
  productGridLoadMoreSignal?: number;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  blocks,
  selectedCategoryId,
  onCategorySelect,
  productGridLoadMoreSignal = 0,
}) => {
  const template = getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID);
  const { data: categories = [] } = useCategories();

  const selectedCategoryName = (() => {
    if (!selectedCategoryId) return 'Airtime';
    const cat = (categories as Category[]).find(
      (category) => category.id === selectedCategoryId
    );
    if (cat) return cat.name;
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
            const heroBlock = block as HeroCarouselBlock;
            const configuredSlides = Array.isArray(heroBlock.props.slides)
              ? heroBlock.props.slides
              : [];

            const slides: HeroSlide[] = configuredSlides.map((slide) => ({
              title: slide.title,
              subtitle: slide.subtitle,
              image: slide.image,
              ctaText: slide.ctaText,
              ctaLink: slide.ctaLink as HeroSlide['ctaLink'],
            }));

            if (slides.length === 0) {
              return <HeroSkeleton key={block.props.id} />;
            }

            return (
              <Hero
                key={block.props.id}
                slides={slides}
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
                loadMoreSignal={productGridLoadMoreSignal}
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
