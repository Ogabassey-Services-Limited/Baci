import { describe, expect, it } from 'vitest';
import { productListQuerySchema } from '@/schemas/product-list-query';

describe('productListQuerySchema', () => {
  it('parses valid query values', () => {
    const parsed = productListQuerySchema.parse({
      page: '2',
      limit: '25',
      migration: 'needs_review',
      status: 'draft',
      stock: 'out_of_stock',
      search: 'ps5',
    });

    expect(parsed).toEqual({
      page: 2,
      limit: 25,
      migration: 'needs_review',
      status: 'draft',
      stock: 'out_of_stock',
      search: 'ps5',
      ids: undefined,
    });
  });

  it('normalizes legacy published status to active', () => {
    const parsed = productListQuerySchema.parse({
      status: 'published',
    });

    expect(parsed.status).toBe('active');
  });

  it('rejects unknown enum filters', () => {
    expect(() =>
      productListQuerySchema.parse({
        migration: 'broken',
        status: 'bad',
        stock: 'wrong',
      })
    ).toThrow();
  });

  it('rejects invalid numeric params', () => {
    expect(() =>
      productListQuerySchema.parse({
        page: '0',
      })
    ).toThrow();
  });

  it('rejects decimal and oversized numeric params', () => {
    expect(() =>
      productListQuerySchema.parse({
        page: '1.5',
      })
    ).toThrow();

    expect(() =>
      productListQuerySchema.parse({
        limit: '101',
      })
    ).toThrow();
  });
});
