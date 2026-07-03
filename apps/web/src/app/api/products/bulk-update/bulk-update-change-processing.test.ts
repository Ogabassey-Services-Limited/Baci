import { describe, expect, it, vi } from 'vitest';
import { processBulkUpdateChanges } from './bulk-update-change-processing';

function createProductsQuery(error: unknown) {
  const query: Record<string, unknown> = {};
  query.eq = vi.fn(() => query);
  // biome-ignore lint/suspicious/noThenProperty: Supabase builders are thenable.
  query.then = vi.fn((resolve: (value: { error: unknown }) => void) =>
    resolve({ error })
  );
  return query;
}

describe('processBulkUpdateChanges', () => {
  it('keeps overlapping product changes while processing independent groups concurrently', async () => {
    const updates: Record<string, unknown>[] = [];
    const inserts: Record<string, unknown>[] = [];
    const supabase = {
      from: vi.fn((table: string) => {
        expect(table).toBe('products');
        return {
          update: vi.fn((payload: Record<string, unknown>) => {
            updates.push(payload);
            return createProductsQuery(null);
          }),
          insert: vi.fn((payload: Record<string, unknown>) => {
            inserts.push(payload);
            return Promise.resolve({ error: null });
          }),
        };
      }),
    };

    const result = await processBulkUpdateChanges({
      changes: [
        {
          type: 'update',
          productId: 'product-1',
          newPrice: 100,
          details: { name: 'Product A', price: 100 },
        },
        {
          type: 'update',
          details: { sku: 'SKU-1', name: 'Product B', price: 200 },
          newPrice: 200,
        },
        {
          type: 'update',
          productId: 'product-1',
          newPrice: 150,
          details: { name: 'Product A', price: 150 },
        },
        {
          type: 'new',
          details: { name: 'New Product', price: 300 },
        },
      ],
      currency: 'NGN',
      merchantBusinessName: 'Test Store',
      merchantId: 'merchant-1',
      supabase: supabase as never,
    });

    expect(result).toEqual({
      updated: 3,
      created: 1,
      removed: 0,
      errors: [],
    });
    expect(updates.map((update) => update.price)).toEqual(
      expect.arrayContaining([100, 150, 200])
    );
    expect(inserts[0]).toMatchObject({
      merchant_id: 'merchant-1',
      name: 'New Product',
      schema_markup: {
        offers: expect.objectContaining({ priceCurrency: 'NGN' }),
      },
    });
  });
});
