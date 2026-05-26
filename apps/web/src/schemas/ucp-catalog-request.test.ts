import { describe, expect, it } from 'vitest';
import {
  ucpCatalogLookupRequestSchema,
  ucpCatalogProductRequestSchema,
  ucpCatalogSearchRequestSchema,
} from './ucp-catalog-request';

describe('ucp catalog request schemas', () => {
  it('accepts a text search request', () => {
    const parsed = ucpCatalogSearchRequestSchema.parse({
      pagination: { limit: 12 },
      query: 'iphone 15',
    });

    expect(parsed.query).toBe('iphone 15');
    expect(parsed.pagination?.limit).toBe(12);
  });

  it('accepts a filter-only browse request', () => {
    const parsed = ucpCatalogSearchRequestSchema.parse({
      filters: { categories: ['phones'] },
    });

    expect(parsed.filters).toEqual({ categories: ['phones'] });
  });

  it('caps the search limit', () => {
    const parsed = ucpCatalogSearchRequestSchema.parse({
      pagination: { limit: 1000 },
      query: 'laptop',
    });

    expect(parsed.pagination?.limit).toBe(50);
  });

  it('accepts lookup ids', () => {
    const parsed = ucpCatalogLookupRequestSchema.parse({
      ids: ['product-1', 'product-2'],
    });

    expect(parsed.ids).toEqual(['product-1', 'product-2']);
  });

  it('accepts a single product detail request', () => {
    const parsed = ucpCatalogProductRequestSchema.parse({
      id: 'product-1',
      preferences: ['Storage', 'Color'],
      selected: [{ label: '256GB', name: 'Storage' }],
    });

    expect(parsed.id).toBe('product-1');
    expect(parsed.selected).toHaveLength(1);
  });
});
