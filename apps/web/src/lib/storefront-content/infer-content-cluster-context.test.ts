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
});
