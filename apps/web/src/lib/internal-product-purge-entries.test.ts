import { describe, expect, it } from 'vitest';
import { buildInternalProductPurgeEntries } from './internal-product-purge-entries';

describe('buildInternalProductPurgeEntries', () => {
  it('substitutes the authoritative row slug for id-only entries', () => {
    const entries = buildInternalProductPurgeEntries(
      [{ id: 'prod-1' }],
      new Map([['prod-1', 'smartphones']]),
      new Map([['prod-1', 'iphone-15']])
    );
    expect(entries).toEqual([
      { slug: 'iphone-15', categorySegment: 'smartphones' },
    ]);
  });

  it('keeps the id as slug when the row has no slug', () => {
    const entries = buildInternalProductPurgeEntries(
      [{ id: 'prod-2' }],
      new Map([['prod-2', null]]),
      new Map()
    );
    expect(entries).toEqual([{ slug: 'prod-2', categorySegment: null }]);
  });

  it('derives the category segment from the legacy text category', () => {
    expect(
      buildInternalProductPurgeEntries([
        { slug: 'iphone-15', category: 'Smartphones' },
      ])
    ).toEqual([{ slug: 'iphone-15', categorySegment: 'smartphones' }]);
  });

  it('prefers the resolved categorySlug over the legacy text', () => {
    expect(
      buildInternalProductPurgeEntries([
        {
          slug: 'rog-ally',
          category: 'Ignored Text',
          categorySlug: 'gaming-laptops',
        },
      ])
    ).toEqual([{ slug: 'rog-ally', categorySegment: 'gaming-laptops' }]);
  });

  it('falls back to the id when the slug is missing (legacy null-slug rows)', () => {
    expect(
      buildInternalProductPurgeEntries([{ id: 'prod-123', category: 'Audio' }])
    ).toEqual([{ slug: 'prod-123', categorySegment: 'audio' }]);
  });

  it('emits a null category segment for the /products/<slug> fallback', () => {
    expect(buildInternalProductPurgeEntries([{ slug: 'mystery-box' }])).toEqual(
      [{ slug: 'mystery-box', categorySegment: null }]
    );
  });

  it('skips entries with neither a slug nor an id', () => {
    expect(
      buildInternalProductPurgeEntries([
        { category: 'Audio' },
        { slug: '   ' },
        { slug: 'valid', category: 'Tablets' },
      ])
    ).toEqual([{ slug: 'valid', categorySegment: 'tablets' }]);
  });

  it('returns an empty list for no products', () => {
    expect(buildInternalProductPurgeEntries([])).toEqual([]);
  });
});
