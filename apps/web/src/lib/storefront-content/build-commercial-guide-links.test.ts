import { describe, expect, it } from 'vitest';
import { buildCommercialGuideLinks } from './build-commercial-guide-links';

describe('buildCommercialGuideLinks', () => {
  it('selects only matching published guides for a compare page', () => {
    const links = buildCommercialGuideLinks({
      storeUrl: 'https://ogabassey.com',
      posts: [
        {
          slug: 'best-phones-in-nigeria',
          title: 'Best Phones in Nigeria',
          excerpt: 'Budget and flagship phone picks.',
          category: 'Smartphones',
          tags: ['smartphones', 'budget', 'iphone'],
          keywords: ['android', 'battery'],
          featured_image_url: null,
          published_at: '2026-04-10T09:00:00.000Z',
          reading_time_minutes: 6,
        },
        {
          slug: 'apple-vs-samsung-buying-guide',
          title: 'Apple vs Samsung Buying Guide',
          excerpt: 'Which ecosystem fits you.',
          category: 'Smartphones',
          tags: ['smartphones', 'apple', 'samsung'],
          keywords: ['iphone', 'galaxy'],
          featured_image_url: null,
          published_at: '2026-04-09T09:00:00.000Z',
          reading_time_minutes: 5,
        },
      ],
      context: {
        pageKind: 'compare',
        categorySlug: 'smartphones',
        brands: ['apple', 'samsung'],
      },
    });

    expect(links.map((link) => link.href)).toEqual([
      'https://ogabassey.com/blog/apple-vs-samsung-buying-guide',
      'https://ogabassey.com/blog/best-phones-in-nigeria',
    ]);
  });

  it('caps the result set at three guides', () => {
    const links = buildCommercialGuideLinks({
      storeUrl: 'https://ogabassey.com',
      posts: Array.from({ length: 4 }, (_, index) => ({
        slug: `smartphone-guide-${index + 1}`,
        title: `Best Smartphones ${index + 1}`,
        excerpt: 'Affordable smartphone picks.',
        category: 'Smartphones',
        tags: ['smartphones'],
        keywords: ['android'],
        featured_image_url: null,
        published_at: `2026-04-0${index + 1}T09:00:00.000Z`,
        reading_time_minutes: 5,
      })),
      context: {
        pageKind: 'category',
        categorySlug: 'smartphones',
      },
    });

    expect(links).toHaveLength(3);
  });

  it('treats malformed published dates as least-recent entries', () => {
    const links = buildCommercialGuideLinks({
      storeUrl: 'https://ogabassey.com',
      posts: [
        {
          slug: 'recent-guide',
          title: 'Best Phones in Nigeria Right Now',
          excerpt: 'Recent smartphone picks.',
          category: 'Smartphones',
          tags: ['smartphones'],
          keywords: ['android'],
          featured_image_url: null,
          published_at: '2026-04-10T09:00:00.000Z',
          reading_time_minutes: 5,
        },
        {
          slug: 'invalid-date-guide',
          title: 'Best Phones in Nigeria on a Budget',
          excerpt: 'Budget smartphone picks.',
          category: 'Smartphones',
          tags: ['smartphones'],
          keywords: ['android'],
          featured_image_url: null,
          published_at: 'not-a-date',
          reading_time_minutes: 5,
        },
      ],
      context: {
        pageKind: 'category',
        categorySlug: 'smartphones',
      },
    });

    expect(links.map((link) => link.href)).toEqual([
      'https://ogabassey.com/blog/recent-guide',
      'https://ogabassey.com/blog/invalid-date-guide',
    ]);
  });
});
