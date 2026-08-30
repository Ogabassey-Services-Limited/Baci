import { render } from '@testing-library/react-native';
import { getTemplateConfig } from '@/lib/templates';
import type { HeroSlide } from './Hero';
import { Hero } from './Hero';

const mockImage = jest.fn();

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ fontScale: 1, height: 800, scale: 2, width: 400 }),
}));

jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Image: (props: Record<string, unknown>) => {
      mockImage(props);
      return React.createElement(View, { ...props, testID: 'hero-image' });
    },
  };
});

jest.mock('expo-linear-gradient', () => {
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return { LinearGradient: View };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#dddddd',
      card: '#ffffff',
      muted: '#f2f2f2',
      text: '#111111',
      textSecondary: '#666666',
    },
    isDark: false,
  }),
}));

jest.mock('@/lib/config', () => ({
  CONFIG: { BUSINESS_TYPE: 'electronics', TEMPLATE_ID: 'test' },
}));

jest.mock('@/lib/templates', () => ({
  getTemplateConfig: jest.fn(),
}));

const mockedGetTemplateConfig = getTemplateConfig as jest.MockedFunction<
  typeof getTemplateConfig
>;

const slide: HeroSlide = {
  ctaLink: '/category/phones',
  ctaText: 'Shop now',
  image: 'https://cdn.ogabassey.com/core-assets/products/hero.avif',
  subtitle: 'Available now',
  title: 'Featured phones',
};

const baseTemplate = {
  borderRadius: 'md' as const,
  cardVariant: 'grid' as const,
  categoryStyle: 'pill' as const,
  features: {},
  headerStyle: 'standard' as const,
  spacing: 'compact' as const,
};

function renderHero(heroVariant: 'parallax' | 'carousel' | 'standard') {
  mockedGetTemplateConfig.mockReturnValue({
    ...baseTemplate,
    heroVariant,
  });
  return render(<Hero slides={[slide]} />);
}

describe('Hero bounded image sources', () => {
  beforeEach(() => {
    mockImage.mockClear();
    mockedGetTemplateConfig.mockReset();
  });

  it('uses a bounded contain source for the elite hero image', () => {
    renderHero('parallax');

    expect(mockImage).toHaveBeenCalledWith(
      expect.objectContaining({
        source: {
          height: 440,
          uri: 'https://cdn.ogabassey.com/image/width=400,height=440,quality=75,format=jpeg/core-assets/products/hero.avif',
          width: 400,
        },
      })
    );
  });

  it('uses a bounded cover source for the fashion hero image', () => {
    renderHero('carousel');

    expect(mockImage).toHaveBeenCalledWith(
      expect.objectContaining({
        source: {
          height: 900,
          uri: 'https://cdn.ogabassey.com/image/width=800,height=900,quality=75,format=jpeg,fit=cover/core-assets/products/hero.avif',
          width: 800,
        },
      })
    );
  });

  it('uses a bounded cover source for the standard hero image', () => {
    renderHero('standard');

    expect(mockImage).toHaveBeenCalledWith(
      expect.objectContaining({
        source: {
          height: 440,
          uri: 'https://cdn.ogabassey.com/image/width=800,height=440,quality=75,format=jpeg,fit=cover/core-assets/products/hero.avif',
          width: 800,
        },
      })
    );
  });
});
