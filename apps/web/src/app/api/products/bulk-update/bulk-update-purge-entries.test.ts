import { describe, expect, it } from 'vitest';
import { getBulkPurgeEntries } from './bulk-update-purge-entries';

describe('getBulkPurgeEntries', () => {
  it('returns no entries when no rows were updated', () => {
    expect(getBulkPurgeEntries(null)).toEqual([]);
  });

  it('uses a trimmed slug and the direct category join', () => {
    expect(
      getBulkPurgeEntries([
        {
          id: 'product-1',
          slug: '  rog-ally  ',
          category: 'Legacy Text',
          categories: { slug: 'gaming-laptops' },
        },
      ])
    ).toEqual([
      {
        slug: 'rog-ally',
        categorySegment: 'gaming-laptops',
      },
    ]);
  });

  it('falls back to the product id and junction category', () => {
    expect(
      getBulkPurgeEntries([
        {
          id: 'legacy-product-1',
          slug: '  ',
          category: null,
          product_categories: [{ categories: { slug: 'accessories' } }],
        },
      ])
    ).toEqual([
      {
        slug: 'legacy-product-1',
        categorySegment: 'accessories',
      },
    ]);
  });
});
