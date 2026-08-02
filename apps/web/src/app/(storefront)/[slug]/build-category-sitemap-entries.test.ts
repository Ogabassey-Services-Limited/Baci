import { describe, expect, it } from 'vitest';
import { buildCategorySitemapEntries } from './build-category-sitemap-entries';

describe('buildCategorySitemapEntries', () => {
  it('keeps only active, nonempty categories for a published storefront', () => {
    expect(
      buildCategorySitemapEntries({
        categories: [
          {
            id: 'fashion',
            slug: 'fashion',
            updated_at: '2026-08-01T00:00:00.000Z',
            is_active: true,
            parent_id: null,
          },
          {
            id: 'empty',
            slug: 'empty',
            updated_at: null,
            is_active: true,
            parent_id: null,
          },
        ],
        categoryCounts: { fashion: 2, empty: 0 },
        isStorePublished: true,
        storeUrl: 'https://zorvexa.usebaci.com',
      })
    ).toEqual([
      expect.objectContaining({
        url: 'https://zorvexa.usebaci.com/fashion',
      }),
    ]);
  });

  it('excludes null activity states instead of inferring active', () => {
    expect(
      buildCategorySitemapEntries({
        categories: [
          {
            id: 'unknown-state',
            slug: 'unknown-state',
            updated_at: null,
            is_active: null,
            parent_id: null,
          },
        ],
        categoryCounts: { 'unknown-state': 1 },
        isStorePublished: true,
        storeUrl: 'https://zorvexa.usebaci.com',
      })
    ).toEqual([]);
  });
});
