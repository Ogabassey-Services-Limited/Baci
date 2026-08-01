import { describe, expect, it } from 'vitest';
import { buildCommercialGuideLinks } from './build-commercial-guide-links';

describe('buildCommercialGuideLinks model-family context', () => {
  it('boosts a family guide above a newer generic brand guide', () => {
    const links = buildCommercialGuideLinks({
      storeUrl: 'https://ogabassey.com',
      posts: [
        {
          slug: 'samsung-buyer-guide',
          title: 'Samsung Phones Buyer Guide',
          excerpt: 'How to choose a Samsung phone.',
          category: 'Smartphones',
          tags: ['smartphones', 'samsung'],
          keywords: ['android'],
          featured_image_url: null,
          published_at: '2026-04-12T09:00:00.000Z',
          reading_time_minutes: 6,
        },
        {
          slug: 'samsung-galaxy-s-buyer-guide',
          title: 'Samsung Galaxy S Buyer Guide',
          excerpt: 'Galaxy S camera, battery, and performance expectations.',
          category: 'Smartphones',
          tags: ['smartphones', 'samsung', 'galaxy s'],
          keywords: ['android'],
          featured_image_url: null,
          published_at: '2026-04-01T09:00:00.000Z',
          reading_time_minutes: 6,
        },
      ],
      context: {
        pageKind: 'category',
        categorySlug: 'smartphones',
        brands: ['Samsung'],
        modelFamilySlug: 'galaxy-s',
        productSlugs: [
          'samsung-galaxy-s24',
          'samsung-galaxy-s25',
          'samsung-galaxy-s26',
        ],
      },
    });

    expect(links.map((link) => link.href)).toEqual([
      'https://ogabassey.com/blog/samsung-galaxy-s-buyer-guide',
      'https://ogabassey.com/blog/samsung-buyer-guide',
    ]);
  });
});
