import { describe, expect, it } from 'vitest';
import {
  buildInternalProductPurgeEntries,
  collectResolvedProductSlugs,
} from './internal-product-purge-entries';

describe('buildInternalProductPurgeEntries', () => {
  it('substitutes the authoritative row slug for id-only entries', () => {
    const entries = buildInternalProductPurgeEntries(
      [{ id: 'prod-1' }],
      new Map([['prod-1', 'smartphones']]),
      new Map([['prod-1', 'iphone-15']])
    );
    expect(entries).toEqual([
      {
        productId: 'prod-1',
        slug: 'iphone-15',
        categorySegment: 'smartphones',
      },
    ]);
  });

  it('keeps the id as slug when the row has no slug', () => {
    const entries = buildInternalProductPurgeEntries(
      [{ id: 'prod-2' }],
      new Map([['prod-2', null]]),
      new Map()
    );
    expect(entries).toEqual([
      { productId: 'prod-2', slug: 'prod-2', categorySegment: null },
    ]);
  });

  it('derives the category segment from the legacy text category', () => {
    expect(
      buildInternalProductPurgeEntries([
        { slug: 'iphone-15', category: 'Smartphones' },
      ])
    ).toEqual([
      { productId: null, slug: 'iphone-15', categorySegment: 'smartphones' },
    ]);
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
    ).toEqual([
      { productId: null, slug: 'rog-ally', categorySegment: 'gaming-laptops' },
    ]);
  });

  it('falls back to the id when the slug is missing (legacy null-slug rows)', () => {
    expect(
      buildInternalProductPurgeEntries([{ id: 'prod-123', category: 'Audio' }])
    ).toEqual([
      { productId: 'prod-123', slug: 'prod-123', categorySegment: 'audio' },
    ]);
  });

  it('emits a null category segment for the /products/<slug> fallback', () => {
    expect(buildInternalProductPurgeEntries([{ slug: 'mystery-box' }])).toEqual(
      [{ productId: null, slug: 'mystery-box', categorySegment: null }]
    );
  });

  it('skips entries with neither a slug nor an id', () => {
    expect(
      buildInternalProductPurgeEntries([
        { category: 'Audio' },
        { slug: '   ' },
        { slug: 'valid', category: 'Tablets' },
      ])
    ).toEqual([{ productId: null, slug: 'valid', categorySegment: 'tablets' }]);
  });

  it('returns an empty list for no products', () => {
    expect(buildInternalProductPurgeEntries([])).toEqual([]);
  });
});

describe('collectResolvedProductSlugs', () => {
  it('includes the authoritative slug, caller slug, and id (rename-safe)', () => {
    expect(
      collectResolvedProductSlugs(
        [{ slug: 'old-slug', id: 'prod-1' }],
        new Map([['prod-1', 'new-slug']])
      )
    ).toEqual(['new-slug', 'old-slug', 'prod-1']);
  });

  it('falls back to caller slug and id when no authoritative map is given', () => {
    expect(
      collectResolvedProductSlugs([{ slug: 'iphone-15', id: 'prod-1' }])
    ).toEqual(['iphone-15', 'prod-1']);
  });

  it('uses the id alone for legacy null-slug rows', () => {
    expect(collectResolvedProductSlugs([{ id: 'prod-9' }])).toEqual(['prod-9']);
  });

  it('deduplicates slug-values across products and trims blanks', () => {
    expect(
      collectResolvedProductSlugs([
        { slug: 'shared', id: 'prod-1' },
        { slug: '  shared  ', id: '  prod-1  ' },
        { slug: '   ' },
      ])
    ).toEqual(['shared', 'prod-1']);
  });

  it('returns an empty list for no products', () => {
    expect(collectResolvedProductSlugs([])).toEqual([]);
  });
});
