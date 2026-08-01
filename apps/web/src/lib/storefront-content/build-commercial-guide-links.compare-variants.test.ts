import { describe, expect, it } from 'vitest';
import { buildCommercialGuideLinks } from './build-commercial-guide-links';

describe('buildCommercialGuideLinks same-brand compare variants', () => {
  it('requires distinct model occurrences for same-brand variants', () => {
    const links = buildCommercialGuideLinks({
      storeUrl: 'https://ogabassey.com',
      posts: [
        {
          slug: 'iphone-15-buyer-guide',
          title: 'iPhone 15 Buyer Guide',
          excerpt:
            'The iPhone 15 buying guide covers battery, camera, and storage options.',
          category: 'Smartphones',
          tags: ['smartphones', 'apple'],
          keywords: null,
          featured_image_url: null,
          published_at: '2026-04-12T09:00:00.000Z',
          reading_time_minutes: 6,
        },
        {
          slug: 'iphone-15-storage-sim-comparison',
          title: 'iPhone 15 128GB eSIM vs iPhone 15 256GB physical SIM',
          excerpt: null,
          category: 'Smartphones',
          tags: ['smartphones', 'apple'],
          keywords: ['comparison'],
          featured_image_url: null,
          published_at: '2026-04-01T09:00:00.000Z',
          reading_time_minutes: 6,
        },
      ],
      context: {
        pageKind: 'compare',
        categorySlug: 'smartphones',
        brands: ['Apple'],
        productNames: [
          'Apple iPhone 15 6GB 128GB eSIM',
          'Apple iPhone 15 6GB 256GB physical SIM',
        ],
      },
    });

    expect(links.map((link) => link.href)).toEqual([
      'https://ogabassey.com/blog/iphone-15-storage-sim-comparison',
      'https://ogabassey.com/blog/iphone-15-buyer-guide',
    ]);
  });
});
