import { describe, expect, it } from 'vitest';
import { buildCuratedStorefront } from './build-curated-storefront';

describe('buildCuratedStorefront', () => {
  it('builds a provider-independent single-H1 hero for a normalized fashion store', () => {
    const input = Object.freeze({
      businessName: 'Threaded',
      businessType: 'fashion-apparel',
      country: 'Nigeria',
      brandColors: {
        primary: '#14532d',
        background: '#fff7ed',
        accent: '#f97316',
      },
      logoUrl: 'https://cdn.example.com/threaded-logo.png',
    });

    const storefront = buildCuratedStorefront(input);
    const hero = storefront.content.find((block) => block.type === 'Hero');

    expect(storefront.content.map((block) => block.type)).toEqual([
      'Header',
      'Hero',
      'ProductGrid',
      'Features',
      'Text',
      'Newsletter',
      'Footer',
    ]);
    expect(hero?.props).toMatchObject({
      id: 'Hero-home',
      headingLevel: 'h1',
      ctaText: 'Explore products',
      ctaLink: '#products',
    });
    expect(hero?.props?.backgroundImage).toBeUndefined();
    expect(hero?.props?.gradient).toContain('linear-gradient');
    expect(
      storefront.content.filter((block) => block.type === 'HeroCarousel')
    ).toHaveLength(0);
    expect(input).toEqual({
      businessName: 'Threaded',
      businessType: 'fashion-apparel',
      country: 'Nigeria',
      brandColors: {
        primary: '#14532d',
        background: '#fff7ed',
        accent: '#f97316',
      },
      logoUrl: 'https://cdn.example.com/threaded-logo.png',
    });
  });
});
