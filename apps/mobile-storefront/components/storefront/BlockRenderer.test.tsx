import { render, screen } from '@testing-library/react-native';
import type { Block } from '@/types/blocks';
import { BlockRenderer } from './BlockRenderer';

jest.mock('@/components/ui/Skeleton', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  return {
    HeroSkeleton: () => (
      <MockText testID="hero-skeleton">Loading hero</MockText>
    ),
  };
});

jest.mock('@/hooks', () => ({
  useCategories: () => ({ data: [] }),
}));

jest.mock('@/lib/config', () => ({
  CONFIG: { BUSINESS_TYPE: 'electronics', TEMPLATE_ID: 'default' },
}));

jest.mock('@/lib/templates', () => ({
  getTemplateConfig: () => ({ categoryStyle: 'default', cardVariant: 'grid' }),
}));

jest.mock('./Hero', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  return {
    Hero: () => <MockText testID="hero-carousel">Hero carousel</MockText>,
  };
});

jest.mock('./ProductGrid', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./UtilityPanel', () => ({
  UtilityPanel: () => null,
}));

const emptyHeroBlock: Block = {
  type: 'HeroCarousel',
  props: { id: 'empty-hero', slides: [] },
};

const configuredHeroBlock: Block = {
  type: 'HeroCarousel',
  props: {
    id: 'configured-hero',
    slides: [
      {
        image: 'https://example.com/banner.jpg',
        title: 'Featured phones',
        subtitle: 'Available now',
        ctaText: 'Shop',
        ctaLink: '/category/phones',
      },
    ],
  },
};

function renderBlocks(blocks: Block[]) {
  return render(
    <BlockRenderer
      blocks={blocks}
      selectedCategoryId={null}
      onCategorySelect={jest.fn()}
    />
  );
}

describe('BlockRenderer', () => {
  it('does not reserve hero placeholder space when resolved content has no slides', () => {
    renderBlocks([emptyHeroBlock]);

    expect(screen.queryByTestId('hero-skeleton')).toBeNull();
  });

  it('renders a configured hero carousel when slides are present', () => {
    renderBlocks([configuredHeroBlock]);

    expect(screen.getByTestId('hero-carousel')).toBeTruthy();
  });
});
