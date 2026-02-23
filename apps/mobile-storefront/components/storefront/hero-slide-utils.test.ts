import {
  getFallbackHeroSlides,
  normalizeHeroSlides,
  resolveHeroSlides,
} from './hero-slide-utils';

describe('normalizeHeroSlides', () => {
  it('maps camelCase hero slide fields', () => {
    const slides = normalizeHeroSlides([
      {
        headline: 'Big Sale',
        description: 'Up to 40% off',
        imageUrl: 'https://cdn.example.com/hero-1.jpg',
        ctaText: 'Shop',
        ctaLink: '/category/phones',
      },
    ]);

    expect(slides).toEqual([
      {
        title: 'Big Sale',
        subtitle: 'Up to 40% off',
        image: 'https://cdn.example.com/hero-1.jpg',
        ctaText: 'Shop',
        ctaLink: '/category/phones',
      },
    ]);
  });

  it('maps snake_case hero slide fields', () => {
    const slides = normalizeHeroSlides([
      {
        title: 'Weekend Deals',
        subtitle: 'Limited offers',
        image_url: 'https://cdn.example.com/hero-2.jpg',
        cta_text: 'Explore',
        cta_link: '/category/all',
      },
    ]);

    expect(slides).toEqual([
      {
        title: 'Weekend Deals',
        subtitle: 'Limited offers',
        image: 'https://cdn.example.com/hero-2.jpg',
        ctaText: 'Explore',
        ctaLink: '/category/all',
      },
    ]);
  });

  it('filters out fully empty hero slides', () => {
    const slides = normalizeHeroSlides([
      {
        headline: '   ',
        subtitle: '',
        imageUrl: '   ',
      },
    ]);

    expect(slides).toEqual([]);
  });

  it('accepts legacy link field as ctaLink', () => {
    const slides = normalizeHeroSlides([
      {
        title: 'Legacy CTA',
        image: 'https://cdn.example.com/hero-3.jpg',
        link: '/category/laptops',
      },
    ]);

    expect(slides).toEqual([
      {
        title: 'Legacy CTA',
        subtitle: '',
        image: 'https://cdn.example.com/hero-3.jpg',
        ctaText: 'Shop Now',
        ctaLink: '/category/laptops',
      },
    ]);
  });

  it('returns empty array for null, undefined, and non-array inputs', () => {
    expect(normalizeHeroSlides(null)).toEqual([]);
    expect(normalizeHeroSlides(undefined)).toEqual([]);
    expect(
      normalizeHeroSlides({} as unknown as Record<string, string>[])
    ).toEqual([]);
    expect(
      normalizeHeroSlides('bad-input' as unknown as Record<string, string>[])
    ).toEqual([]);
  });
});

describe('resolveHeroSlides', () => {
  it('uses block slides when page-config hero slides are present', () => {
    const resolved = resolveHeroSlides(
      [
        {
          title: 'Config Slide',
          subtitle: 'From page config',
          image: 'https://cdn.example.com/config-hero.jpg',
          ctaText: 'Open',
          ctaLink: '/category/config',
        },
      ],
      [
        {
          title: 'Merchant Slide',
          imageUrl: 'https://cdn.example.com/merchant-hero.jpg',
        },
      ]
    );

    expect(resolved).toEqual([
      {
        title: 'Config Slide',
        subtitle: 'From page config',
        image: 'https://cdn.example.com/config-hero.jpg',
        ctaText: 'Open',
        ctaLink: '/category/config',
      },
    ]);
  });

  it('falls back to merchant slides when block slides are empty', () => {
    const resolved = resolveHeroSlides(
      [],
      [
        {
          headline: 'Merchant Slide',
          imageUrl: 'https://cdn.example.com/merchant-hero.jpg',
        },
      ]
    );

    expect(resolved).toEqual([
      {
        title: 'Merchant Slide',
        subtitle: '',
        image: 'https://cdn.example.com/merchant-hero.jpg',
        ctaText: 'Shop Now',
        ctaLink: '/category/all',
      },
    ]);
  });

  it('prioritizes merchant slides when preferMerchantSlides is enabled', () => {
    const resolved = resolveHeroSlides(
      [
        {
          title: 'Config Slide',
          subtitle: 'From page config',
          image: 'https://cdn.example.com/config-hero.jpg',
          ctaText: 'Open',
          ctaLink: '/category/config',
        },
      ],
      [
        {
          headline: 'Merchant Slide',
          imageUrl: 'https://cdn.example.com/merchant-hero.jpg',
        },
      ],
      true
    );

    expect(resolved).toEqual([
      {
        title: 'Merchant Slide',
        subtitle: '',
        image: 'https://cdn.example.com/merchant-hero.jpg',
        ctaText: 'Shop Now',
        ctaLink: '/category/all',
      },
    ]);
  });

  it('returns empty array when both sources are invalid', () => {
    expect(
      resolveHeroSlides(
        'bad-block' as unknown as Record<string, string>[],
        { bad: 'merchant' } as unknown as Record<string, string>[]
      )
    ).toEqual([]);
  });

  it('returns empty array when both sources are null', () => {
    expect(resolveHeroSlides(null, null)).toEqual([]);
  });
});

describe('getFallbackHeroSlides', () => {
  it('uses merchant name when provided', () => {
    const slides = getFallbackHeroSlides('TrendyShop');

    expect(slides[0]?.title).toBe('Welcome to TrendyShop');
    expect(slides[0]?.ctaLink).toBe('/category/all');
  });

  it('uses generic title when merchant name is missing', () => {
    const slides = getFallbackHeroSlides('   ');

    expect(slides[0]).toEqual({
      title: 'Welcome to Our Store',
      subtitle: 'Discover top deals and new arrivals',
      image: '',
      ctaText: 'Shop Now',
      ctaLink: '/category/all',
    });
  });

  it('uses generic fallback for undefined and empty store names', () => {
    expect(getFallbackHeroSlides()[0]).toEqual({
      title: 'Welcome to Our Store',
      subtitle: 'Discover top deals and new arrivals',
      image: '',
      ctaText: 'Shop Now',
      ctaLink: '/category/all',
    });

    expect(getFallbackHeroSlides('')[0]).toEqual({
      title: 'Welcome to Our Store',
      subtitle: 'Discover top deals and new arrivals',
      image: '',
      ctaText: 'Shop Now',
      ctaLink: '/category/all',
    });
  });
});
