import { describe, expect, it } from 'vitest';
import {
  areHeroSlidesEquivalent,
  extractHeroSlidesFromPageConfig,
  hasHeroSlidesInPageConfig,
  upsertHeroSlidesIntoPageConfig,
} from './hero-carousel-config';

describe('hero-carousel-config', () => {
  it('extracts slides from HeroCarousel builder blocks', () => {
    const config = {
      content: [
        {
          type: 'HeroCarousel',
          props: {
            id: 'hero-1',
            slides: [
              {
                title: 'Latest Smartphones',
                subtitle: 'Discover flagship devices',
                image: 'https://cdn.example.com/hero-1.png',
                ctaText: 'Shop Phones',
                ctaLink: '/category/smartphones',
              },
            ],
          },
        },
      ],
    };

    const slides = extractHeroSlidesFromPageConfig(config);

    expect(slides).toEqual([
      {
        id: 'slide-1',
        imageUrl: 'https://cdn.example.com/hero-1.png',
        headline: 'Latest Smartphones',
        description: 'Discover flagship devices',
        cta: 'Shop Phones',
        link: '/category/smartphones',
      },
    ]);
  });

  it('extracts slides from custom hero blocks using legacy keys', () => {
    const config = {
      content: [
        {
          type: 'OgabasseyHero',
          props: {
            slides: [
              {
                id: 'legacy-1',
                headline: 'Laptops & Computing',
                description: 'Work machines and gaming rigs',
                imageUrl: 'https://cdn.example.com/hero-legacy.png',
                cta: 'Browse Laptops',
                link: '/category/laptops',
              },
            ],
          },
        },
      ],
    };

    const slides = extractHeroSlidesFromPageConfig(config);

    expect(slides[0]).toMatchObject({
      id: 'legacy-1',
      headline: 'Laptops & Computing',
      cta: 'Browse Laptops',
    });
  });

  it('adds a HeroCarousel block when the config has no hero block', () => {
    const originalConfig = {
      root: { title: 'Home' },
      content: [
        {
          type: 'CategoryRail',
          props: { id: 'categories' },
        },
      ],
    };

    const updated = upsertHeroSlidesIntoPageConfig(originalConfig, [
      {
        id: 'slide-1',
        imageUrl: 'https://cdn.example.com/new.png',
        headline: 'Accessories & Audio',
        description: 'Top picks for creators',
        cta: 'Browse Accessories',
        link: '/category/accessories',
      },
    ]);

    const updatedContent = Array.isArray(updated.content)
      ? updated.content
      : [];

    expect(updatedContent[0]).toMatchObject({
      type: 'HeroCarousel',
    });
    expect(hasHeroSlidesInPageConfig(updated)).toBe(true);
  });

  it('replaces slides on an existing hero block without touching other blocks', () => {
    const originalConfig = {
      content: [
        {
          type: 'HeroCarousel',
          props: {
            id: 'hero-1',
            slides: [
              {
                title: 'Old Slide',
                subtitle: 'Old Subtitle',
                image: 'https://cdn.example.com/old.png',
              },
            ],
          },
        },
        {
          type: 'ProductGrid',
          props: {
            id: 'products',
            limit: 12,
          },
        },
      ],
    };

    const updated = upsertHeroSlidesIntoPageConfig(originalConfig, [
      {
        id: 'slide-1',
        imageUrl: 'https://cdn.example.com/new.png',
        headline: 'New Slide',
        description: 'New Subtitle',
        cta: 'Shop Now',
        link: '/category/all',
      },
    ]);

    const updatedContent = Array.isArray(updated.content)
      ? updated.content
      : [];

    expect(updatedContent).toHaveLength(2);
    expect(updatedContent[1]).toMatchObject({
      type: 'ProductGrid',
      props: { id: 'products', limit: 12 },
    });

    const slides = extractHeroSlidesFromPageConfig(updated);
    expect(slides[0]).toMatchObject({
      headline: 'New Slide',
      description: 'New Subtitle',
    });
  });

  it('treats two normalized slide sets as equivalent only when all values match', () => {
    const a = [
      {
        id: 'slide-1',
        imageUrl: 'https://cdn.example.com/a.png',
        headline: 'Headline',
        description: 'Description',
        cta: 'CTA',
        link: '/category/all',
      },
    ];

    const b = [
      {
        id: 'another-id',
        imageUrl: 'https://cdn.example.com/a.png',
        headline: 'Headline',
        description: 'Description',
        cta: 'CTA',
        link: '/category/all',
      },
    ];

    const c = [
      {
        id: 'slide-1',
        imageUrl: 'https://cdn.example.com/changed.png',
        headline: 'Headline',
        description: 'Description',
        cta: 'CTA',
        link: '/category/all',
      },
    ];

    expect(areHeroSlidesEquivalent(a, b)).toBe(true);
    expect(areHeroSlidesEquivalent(a, c)).toBe(false);
  });
});
