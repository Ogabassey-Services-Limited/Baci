import { describe, expect, it } from 'vitest';
import { buildCommercialGuideLinks } from './build-commercial-guide-links';

describe('buildCommercialGuideLinks numeric compare brands', () => {
  it('binds numeric compare identifiers to their source brands', () => {
    const links = buildCommercialGuideLinks({
      storeUrl: 'https://ogabassey.com',
      posts: [
        {
          slug: 'samsung-galaxy-s25-15-reasons',
          title: 'Samsung Galaxy S25: 15 reasons to buy',
          excerpt: 'A Samsung buyer guide for the Galaxy S25.',
          category: 'Smartphones',
          tags: ['smartphones', 'samsung', 'galaxy s25'],
          keywords: ['buyer guide'],
          featured_image_url: null,
          published_at: '2026-04-12T09:00:00.000Z',
          reading_time_minutes: 6,
        },
        {
          slug: 'iphone-15-vs-galaxy-s25-guide',
          title: 'Apple iPhone 15 vs Samsung Galaxy S25 Buyer Guide',
          excerpt: 'Compare Apple iPhone 15 and Samsung Galaxy S25.',
          category: 'Smartphones',
          tags: ['smartphones', 'apple', 'samsung', 'comparison'],
          keywords: ['buyer guide'],
          featured_image_url: null,
          published_at: '2026-04-01T09:00:00.000Z',
          reading_time_minutes: 6,
        },
      ],
      context: {
        pageKind: 'compare',
        categorySlug: 'smartphones',
        productNames: ['Apple iPhone 15', 'Samsung Galaxy S25'],
      },
    });

    expect(links.map((link) => link.href)).toEqual([
      'https://ogabassey.com/blog/iphone-15-vs-galaxy-s25-guide',
      'https://ogabassey.com/blog/samsung-galaxy-s25-15-reasons',
    ]);
  });
});
