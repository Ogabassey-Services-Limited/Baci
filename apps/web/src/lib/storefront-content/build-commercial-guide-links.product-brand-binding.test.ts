import { describe, expect, it } from 'vitest';
import { buildCommercialGuideLinks } from './build-commercial-guide-links';

describe('buildCommercialGuideLinks product brand binding', () => {
  it('does not boost a shared model phrase under the wrong brand', () => {
    const links = buildCommercialGuideLinks({
      storeUrl: 'https://ogabassey.com',
      posts: [
        {
          slug: 'redmi-note-14-pro-vs-iphone-13-guide',
          title: 'Redmi Note 14 Pro vs Apple iPhone 13 Buyer Guide',
          excerpt: 'Compare Redmi Note 14 Pro with Apple iPhone 13.',
          category: 'Smartphones',
          tags: ['smartphones', 'redmi', 'apple'],
          keywords: ['buyer guide'],
          featured_image_url: null,
          published_at: '2026-04-12T09:00:00.000Z',
          reading_time_minutes: 6,
        },
        {
          slug: 'iphone-14-pro-buyer-guide',
          title: 'Apple iPhone 14 Pro Buyer Guide',
          excerpt: 'What to know before buying Apple iPhone 14 Pro.',
          category: 'Smartphones',
          tags: ['smartphones', 'apple', 'iphone 14 pro'],
          keywords: ['buyer guide'],
          featured_image_url: null,
          published_at: '2026-04-01T09:00:00.000Z',
          reading_time_minutes: 6,
        },
      ],
      context: {
        pageKind: 'product',
        categorySlug: 'smartphones',
        brands: ['Apple'],
        productNames: ['Apple iPhone 14 Pro'],
        productSlugs: ['apple-iphone-14-pro'],
      },
    });

    expect(links[0]?.href).toBe(
      'https://ogabassey.com/blog/iphone-14-pro-buyer-guide'
    );
  });

  it('does not boost a compare guide when a model precedes its brand', () => {
    const links = buildCommercialGuideLinks({
      storeUrl: 'https://ogabassey.com',
      posts: [
        {
          slug: 'watch-ultra-apple-vs-samsung-guide',
          title: 'Watch Ultra Apple vs Samsung Watch Ultra Buyer Guide',
          excerpt: 'A comparison of these flagship smartwatches.',
          category: 'Smartwatches',
          tags: ['smartwatches', 'apple', 'samsung', 'comparison'],
          keywords: ['buyer guide'],
          featured_image_url: null,
          published_at: '2026-04-12T09:00:00.000Z',
          reading_time_minutes: 6,
        },
        {
          slug: 'apple-watch-ultra-vs-samsung-watch-ultra-guide',
          title: 'Apple Watch Ultra vs Samsung Watch Ultra Buyer Guide',
          excerpt: 'A comparison of these flagship smartwatches.',
          category: 'Smartwatches',
          tags: ['smartwatches', 'apple', 'samsung', 'comparison'],
          keywords: ['buyer guide'],
          featured_image_url: null,
          published_at: '2026-04-01T09:00:00.000Z',
          reading_time_minutes: 6,
        },
      ],
      context: {
        pageKind: 'compare',
        categorySlug: 'smartwatches',
        brands: ['Apple', 'Samsung'],
        productNames: ['Apple Watch Ultra', 'Samsung Watch Ultra'],
        productSlugs: ['apple-watch-ultra-49mm', 'samsung-watch-ultra'],
      },
    });

    expect(links[0]?.href).toBe(
      'https://ogabassey.com/blog/apple-watch-ultra-vs-samsung-watch-ultra-guide'
    );
  });
});
