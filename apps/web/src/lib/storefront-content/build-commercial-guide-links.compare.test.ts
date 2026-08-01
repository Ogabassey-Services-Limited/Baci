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

  it('does not boost an iPhone 15 Pro guide for the base iPhone 15 product', () => {
    const links = buildCommercialGuideLinks({
      storeUrl: 'https://ogabassey.com',
      posts: [
        {
          slug: 'iphone-15-pro-buyer-guide',
          title: 'iPhone 15 Pro Buyer Guide',
          excerpt: 'What to know before buying the iPhone 15 Pro.',
          category: 'Smartphones',
          tags: ['smartphones', 'apple', 'iphone 15 pro'],
          keywords: ['camera'],
          featured_image_url: null,
          published_at: '2026-04-12T09:00:00.000Z',
          reading_time_minutes: 6,
        },
        {
          slug: 'iphone-15-buyer-guide',
          title: 'iPhone 15 Buyer Guide',
          excerpt:
            'What to know before buying the iPhone 15, including whether the iPhone 15 Pro is worth it.',
          category: 'Smartphones',
          tags: ['smartphones', 'apple', 'iphone 15'],
          keywords: ['camera'],
          featured_image_url: null,
          published_at: '2026-04-01T09:00:00.000Z',
          reading_time_minutes: 6,
        },
      ],
      context: {
        pageKind: 'product',
        categorySlug: 'smartphones',
        brands: ['Apple'],
        productSlugs: ['iphone-15'],
      },
    });

    expect(links.map((link) => link.href)).toEqual([
      'https://ogabassey.com/blog/iphone-15-buyer-guide',
      'https://ogabassey.com/blog/iphone-15-pro-buyer-guide',
    ]);
  });

  it('does not boost an Apple Watch Ultra 2 guide for the base Ultra product', () => {
    const links = buildCommercialGuideLinks({
      storeUrl: 'https://ogabassey.com',
      posts: [
        {
          slug: 'apple-watch-ultra-2-buyer-guide',
          title: 'Apple Watch Ultra 2 Buyer Guide',
          excerpt: 'What to know before buying the Apple Watch Ultra 2.',
          category: 'Smartwatches',
          tags: ['smartwatches', 'apple', 'watch ultra 2'],
          keywords: ['battery'],
          featured_image_url: null,
          published_at: '2026-04-12T09:00:00.000Z',
          reading_time_minutes: 6,
        },
        {
          slug: 'apple-watch-ultra-buyer-guide',
          title: 'Apple Watch Ultra Buyer Guide',
          excerpt: 'What to know before buying the Apple Watch Ultra.',
          category: 'Smartwatches',
          tags: ['smartwatches', 'apple', 'watch ultra'],
          keywords: ['battery'],
          featured_image_url: null,
          published_at: '2026-04-01T09:00:00.000Z',
          reading_time_minutes: 6,
        },
      ],
      context: {
        pageKind: 'product',
        categorySlug: 'smartwatches',
        brands: ['Apple'],
        productSlugs: ['apple-watch-ultra'],
      },
    });

    expect(links.map((link) => link.href)).toEqual([
      'https://ogabassey.com/blog/apple-watch-ultra-buyer-guide',
      'https://ogabassey.com/blog/apple-watch-ultra-2-buyer-guide',
    ]);
  });
});
