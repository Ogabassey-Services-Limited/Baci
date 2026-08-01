import { describe, expect, it } from 'vitest';
import { buildCommercialGuideLinks } from './build-commercial-guide-links';

describe('buildCommercialGuideLinks game titles', () => {
  it('matches spaced Play Station slugs to branded PlayStation guides', () => {
    const links = buildCommercialGuideLinks({
      storeUrl: 'https://ogabassey.com',
      posts: [
        {
          slug: 'best-playstation-5-games',
          title: 'Best PlayStation 5 Games',
          excerpt: 'A current shortlist for console buyers.',
          category: 'PlayStation 5',
          tags: ['playstation', 'ps5', 'games'],
          keywords: ['buying guide'],
          featured_image_url: null,
          published_at: '2026-04-12T09:00:00.000Z',
          reading_time_minutes: 6,
        },
        {
          slug: 'playstation-5-madden-24-guide',
          title: 'PlayStation 5 Madden 24 Buyer Guide',
          excerpt: 'What to know before buying Madden 24.',
          category: 'PlayStation 5',
          tags: ['playstation', 'madden 24'],
          keywords: ['buying guide'],
          featured_image_url: null,
          published_at: '2026-04-01T09:00:00.000Z',
          reading_time_minutes: 6,
        },
      ],
      context: {
        pageKind: 'product',
        categorySlug: 'playstation-5',
        brands: ['PlayStation'],
        productSlugs: ['play-station-5-madden-24'],
      },
    });

    expect(links.map((link) => link.href)).toEqual([
      'https://ogabassey.com/blog/playstation-5-madden-24-guide',
      'https://ogabassey.com/blog/best-playstation-5-games',
    ]);
  });

  it('matches possessive game titles after normalizing apostrophe-s', () => {
    const links = buildCommercialGuideLinks({
      storeUrl: 'https://ogabassey.com',
      posts: [
        {
          slug: 'best-ps4-games',
          title: 'Best PS4 Games',
          excerpt: 'A current shortlist for console buyers.',
          category: 'PlayStation 4',
          tags: ['playstation', 'ps4', 'games'],
          keywords: ['buying guide'],
          featured_image_url: null,
          published_at: '2026-04-12T09:00:00.000Z',
          reading_time_minutes: 6,
        },
        {
          slug: 'assassins-creed-odyssey-guide',
          title: "Assassin's Creed Odyssey Buyer Guide",
          excerpt: "What to know before buying Assassin's Creed Odyssey.",
          category: 'PlayStation 4',
          tags: ['playstation', 'assassins creed odyssey'],
          keywords: ['buying guide'],
          featured_image_url: null,
          published_at: '2026-04-01T09:00:00.000Z',
          reading_time_minutes: 6,
        },
      ],
      context: {
        pageKind: 'product',
        categorySlug: 'playstation-4',
        brands: ['PlayStation'],
        productSlugs: ['ps4-assassin-s-creed-odyssey'],
      },
    });

    expect(links.map((link) => link.href)).toEqual([
      'https://ogabassey.com/blog/assassins-creed-odyssey-guide',
      'https://ogabassey.com/blog/best-ps4-games',
    ]);
  });
});
