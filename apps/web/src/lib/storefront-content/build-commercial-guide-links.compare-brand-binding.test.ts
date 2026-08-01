import { describe, expect, it } from 'vitest';
import { buildCommercialGuideLinks } from './build-commercial-guide-links';

describe('buildCommercialGuideLinks compare brand binding', () => {
  it('does not treat one unqualified collision as both compared brands', () => {
    const links = buildCommercialGuideLinks({
      storeUrl: 'https://ogabassey.com',
      posts: [
        {
          slug: 'apple-and-samsung-watch-ultra-guide',
          title: 'Apple and Samsung Watch Ultra Buyer Guide',
          excerpt: 'A single guide to the shared watch ultra category.',
          category: 'Smartwatches',
          tags: ['smartwatches', 'apple', 'samsung'],
          keywords: ['buyer guide'],
          featured_image_url: null,
          published_at: '2026-04-12T09:00:00.000Z',
          reading_time_minutes: 6,
        },
        {
          slug: 'apple-watch-ultra-vs-samsung-watch-ultra',
          title: 'Apple Watch Ultra vs Samsung Watch Ultra Buyer Guide',
          excerpt: 'Compare Apple Watch Ultra and Samsung Watch Ultra.',
          category: 'Smartwatches',
          tags: ['smartwatches', 'apple', 'samsung', 'watch ultra'],
          keywords: ['comparison'],
          featured_image_url: null,
          published_at: '2026-04-01T09:00:00.000Z',
          reading_time_minutes: 6,
        },
      ],
      context: {
        pageKind: 'compare',
        categorySlug: 'smartwatches',
        brands: ['Apple', 'Samsung'],
        productSlugs: ['apple-watch-ultra-49mm', 'samsung-watch-ultra'],
      },
    });

    expect(links.map((link) => link.href)).toEqual([
      'https://ogabassey.com/blog/apple-watch-ultra-vs-samsung-watch-ultra',
      'https://ogabassey.com/blog/apple-and-samsung-watch-ultra-guide',
    ]);
  });
});
