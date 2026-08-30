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
          status: 'active',
          categories: { slug: 'gaming-laptops' },
        },
      ])
    ).toEqual([
      {
        productId: 'product-1',
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
          status: 'active',
          product_categories: [{ categories: { slug: 'accessories' } }],
        },
      ])
    ).toEqual([
      {
        productId: 'legacy-product-1',
        slug: 'legacy-product-1',
        categorySegment: 'accessories',
      },
    ]);
  });

  it('returns no public entries for 51 draft products', () => {
    const draftRows = Array.from({ length: 51 }, (_, index) => ({
      id: `draft-${index}`,
      slug: `draft-product-${index}`,
      category: 'Drafts',
      status: 'draft',
    }));

    expect(getBulkPurgeEntries(draftRows)).toEqual([]);
  });
});
