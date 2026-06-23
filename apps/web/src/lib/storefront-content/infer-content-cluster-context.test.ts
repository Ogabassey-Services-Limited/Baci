import { describe, expect, it } from 'vitest';
import { inferContentClusterContext } from '@/lib/storefront-content/infer-content-cluster-context';

describe('inferContentClusterContext', () => {
  it('infers smartphones best-in-nigeria context from blog metadata', () => {
    expect(
      inferContentClusterContext({
        title: 'Best Phones in Nigeria for 2026',
        excerpt: 'Affordable Android and iPhone picks',
        category: 'Smartphones',
        tags: ['budget', 'iphone'],
        keywords: ['android', 'battery'],
      })
    ).toMatchObject({
      categorySlug: 'smartphones',
      kind: 'best-in-nigeria',
      brands: ['apple'],
    });
  });

  it('infers expanded Ogabassey verticals from category and article terms', () => {
    expect(
      inferContentClusterContext({
        title: 'JBL Charge 6 vs Soundbar: Which Audio Device Fits Your Room?',
        excerpt: 'Bluetooth speaker and soundbar buying guide.',
        category: 'Audio',
        tags: ['jbl', 'speaker'],
        keywords: ['bluetooth', 'soundbar'],
      })
    ).toMatchObject({
      categorySlug: 'audio',
      kind: 'decision-support',
      brands: ['jbl'],
    });

    expect(
      inferContentClusterContext({
        title: 'HP LaserJet Printer Setup and Toner Buying Guide',
        excerpt: 'Wireless office printer maintenance and cartridge context.',
        category: 'Printers',
        tags: ['hp', 'printer'],
        keywords: ['toner', 'wireless'],
      })
    ).toMatchObject({
      categorySlug: 'printers',
      kind: 'buyer-guide',
      brands: ['hp'],
    });

    expect(
      inferContentClusterContext({
        title: 'PlayStation 5 Disc Edition vs Digital Edition',
        excerpt: 'PS5 console bundle decision guide.',
        category: 'PlayStation 5',
        tags: ['ps5', 'playstation'],
        keywords: ['console', 'dualsense'],
      })
    ).toMatchObject({
      categorySlug: 'playstation-5',
      kind: 'decision-support',
      brands: ['playstation'],
    });
  });

  it('returns nulls when category and intent cannot be inferred', () => {
    expect(
      inferContentClusterContext({
        title: 'Store update',
        excerpt: 'General merchant news',
        category: 'News',
        tags: ['launch'],
        keywords: ['update'],
      })
    ).toMatchObject({
      categorySlug: null,
      kind: null,
      brands: [],
      matchedPriceBands: [],
    });
  });

  it('deduplicates brand matches when the post spans multiple supported categories', () => {
    expect(
      inferContentClusterContext({
        title: 'Samsung phones, Samsung TVs, and the best Samsung picks',
        excerpt: 'Comparing Samsung devices across categories',
        category: 'Reviews',
        tags: ['samsung'],
        keywords: ['smartphones', 'smart tvs'],
      }).brands
    ).toEqual(['samsung']);
  });

  it('prefers the most specific explicit category alias over generic parent aliases', () => {
    expect(
      inferContentClusterContext({
        title: 'RTX Gaming Laptop Buying Guide',
        excerpt: 'Gaming notebooks with RTX graphics.',
        category: 'Gaming Laptops',
        tags: ['rtx', 'laptops'],
        keywords: ['gaming laptops'],
      }).categorySlug
    ).toBe('gaming-laptops');

    expect(
      inferContentClusterContext({
        title: 'Nintendo Switch 2 Launch Bundle Guide',
        excerpt: 'Console bundle context for buyers.',
        category: 'Nintendo Switch 2',
        tags: ['switch', 'switch 2'],
        keywords: ['console'],
      }).categorySlug
    ).toBe('nintendo-switch-2');
  });
});
