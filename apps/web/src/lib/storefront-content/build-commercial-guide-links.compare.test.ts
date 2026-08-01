import { describe, expect, it } from 'vitest';
import { buildCommercialGuideLinks } from './build-commercial-guide-links';

describe('buildCommercialGuideLinks compare context', () => {
  it('ranks a guide covering both compared models above a one-model guide', () => {
    const links = buildCommercialGuideLinks({
      storeUrl: 'https://ogabassey.com',
      posts: [
        {
          slug: 'samsung-galaxy-s25-buyer-guide',
          title: 'Samsung Galaxy S25 Buyer Guide',
          excerpt: 'What to know before buying the Galaxy S25.',
          category: 'Smartphones',
          tags: ['smartphones', 'samsung', 'galaxy s25'],
          keywords: ['android'],
          featured_image_url: null,
          published_at: '2026-04-12T09:00:00.000Z',
          reading_time_minutes: 6,
        },
        {
          slug: 'samsung-galaxy-s25-vs-s24-guide',
          title: 'Samsung Galaxy S25 vs S24 Buyer Guide',
          excerpt: 'Compare the Galaxy S25 and S24 before you buy.',
          category: 'Smartphones',
          tags: ['smartphones', 'samsung', 'galaxy s25', 'galaxy s24'],
          keywords: ['comparison', 'android'],
          featured_image_url: null,
          published_at: '2026-04-01T09:00:00.000Z',
          reading_time_minutes: 6,
        },
      ],
      context: {
        pageKind: 'compare',
        categorySlug: 'smartphones',
        brands: ['Samsung'],
        productSlugs: ['samsung-galaxy-s25', 'samsung-galaxy-s24'],
      },
    });

    expect(links.map((link) => link.href)).toEqual([
      'https://ogabassey.com/blog/samsung-galaxy-s25-vs-s24-guide',
      'https://ogabassey.com/blog/samsung-galaxy-s25-buyer-guide',
    ]);
  });
});
