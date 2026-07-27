import { describe, expect, it, vi } from 'vitest';
import type { StorefrontProductPurgeEntry } from '@/lib/storefront-product-purge-urls';
import { processBulkUpdateChanges } from './bulk-update-change-processing';

function createProductsQuery(error: unknown, data: unknown[] = []) {
  const query: Record<string, unknown> = {};
  query.eq = vi.fn(() => query);
  query.select = vi.fn(() => query);
  // biome-ignore lint/suspicious/noThenProperty: Supabase builders are thenable.
  query.then = vi.fn(
    (resolve: (value: { data: unknown[]; error: unknown }) => void) =>
      resolve({ data, error })
  );
  return query;
}

describe('processBulkUpdateChanges', () => {
  it('reports a previous-row read failure without emitting public purge entries', async () => {
    const onPurgeEntries = vi.fn();
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() =>
          createProductsQuery(new Error('previous rows unavailable'))
        ),
      })),
    };

    const result = await processBulkUpdateChanges({
      changes: [
        {
          type: 'update',
          productId: 'product-1',
          newPrice: 100,
          details: { name: 'Product A', price: 100 },
        },
      ],
      currency: 'NGN',
      merchantBusinessName: 'Test Store',
      merchantId: 'merchant-1',
      onPurgeEntries,
      supabase: supabase as never,
    });

    expect(result).toEqual({
      updated: 0,
      created: 0,
      removed: 0,
      errors: ['Failed to update "Product A"'],
    });
    expect(onPurgeEntries).not.toHaveBeenCalled();
  });

  it('keeps overlapping product changes while processing independent groups concurrently', async () => {
    const updates: Record<string, unknown>[] = [];
    const inserts: Record<string, unknown>[] = [];
    const supabase = {
      from: vi.fn((table: string) => {
        expect(table).toBe('products');
        return {
          select: vi.fn(() => createProductsQuery(null)),
          update: vi.fn((payload: Record<string, unknown>) => {
            updates.push(payload);
            return createProductsQuery(null);
          }),
          insert: vi.fn((payload: Record<string, unknown>) => {
            inserts.push(payload);
            return {
              select: vi.fn(() => ({
                maybeSingle: vi.fn(() =>
                  Promise.resolve({ data: { id: 'created-id' }, error: null })
                ),
              })),
            };
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

  it('caps concurrent product groups at ten', async () => {
    let activeGroups = 0;
    let maxActiveGroups = 0;
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => createProductsQuery(null)),
        update: vi.fn(() => {
          const query: Record<string, unknown> = {};
          query.eq = vi.fn(() => query);
          query.select = vi.fn(() => query);
          // biome-ignore lint/suspicious/noThenProperty: Supabase builders are thenable.
          query.then = vi.fn(
            (resolve: (value: { error: null }) => void) =>
              new Promise<void>((complete) => {
                activeGroups += 1;
                maxActiveGroups = Math.max(maxActiveGroups, activeGroups);
                Promise.resolve().then(() => {
                  activeGroups -= 1;
                  resolve({ error: null });
                  complete();
                });
              })
          );
          return query;
        }),
      })),
    };

    await processBulkUpdateChanges({
      changes: Array.from({ length: 11 }, (_, index) => ({
        type: 'update' as const,
        productId: `product-${index}`,
        newPrice: index,
        details: { price: index },
      })),
      currency: 'NGN',
      merchantBusinessName: 'Test Store',
      merchantId: 'merchant-1',
      supabase: supabase as never,
    });

    expect(maxActiveGroups).toBe(10);
  });

  it('keeps differently cased UUIDs for the same product sequential', async () => {
    let activeUpdates = 0;
    let maxActiveUpdates = 0;
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => createProductsQuery(null)),
        update: vi.fn(() => {
          const query: Record<string, unknown> = {};
          query.eq = vi.fn(() => query);
          query.select = vi.fn(() => query);
          // biome-ignore lint/suspicious/noThenProperty: Supabase builders are thenable.
          query.then = vi.fn(
            (resolve: (value: { error: null }) => void) =>
              new Promise<void>((complete) => {
                activeUpdates += 1;
                maxActiveUpdates = Math.max(maxActiveUpdates, activeUpdates);
                Promise.resolve().then(() => {
                  activeUpdates -= 1;
                  resolve({ error: null });
                  complete();
                });
              })
          );
          return query;
        }),
      })),
    };
    const productId = 'A0000000-0000-4000-8000-000000000000';

    await processBulkUpdateChanges({
      changes: [
        {
          type: 'update',
          productId,
          newPrice: 100,
          details: { name: 'Product A', price: 100 },
        },
        {
          type: 'update',
          productId: productId.toLowerCase(),
          newPrice: 150,
          details: { name: 'Product A', price: 150 },
        },
      ],
      currency: 'NGN',
      merchantBusinessName: 'Test Store',
      merchantId: 'merchant-1',
      supabase: supabase as never,
    });

    expect(maxActiveUpdates).toBe(1);
  });

  it('serializes new products with slug-generating updates', async () => {
    let activeChanges = 0;
    let maxActiveChanges = 0;
    const runChange = async () => {
      activeChanges += 1;
      maxActiveChanges = Math.max(maxActiveChanges, activeChanges);
      await Promise.resolve();
      activeChanges -= 1;
    };
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => createProductsQuery(null)),
        update: vi.fn(() => {
          const query: Record<string, unknown> = {};
          query.eq = vi.fn(() => query);
          query.select = vi.fn(() => query);
          // biome-ignore lint/suspicious/noThenProperty: Supabase builders are thenable.
          query.then = vi.fn(
            (resolve: (value: { data: []; error: null }) => void) =>
              runChange().then(() => resolve({ data: [], error: null }))
          );
          return query;
        }),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              runChange().then(() => ({
                data: { id: 'created-id' },
                error: null,
              }))
            ),
          })),
        })),
      })),
    };

    await processBulkUpdateChanges({
      changes: [
        {
          type: 'update',
          productId: 'a0000000-0000-4000-8000-000000000000',
          newPrice: 100,
          details: { name: 'Shared Slug', price: 100 },
        },
        {
          type: 'new',
          details: { name: 'Shared Slug', price: 150 },
        },
      ],
      currency: 'NGN',
      merchantBusinessName: 'Test Store',
      merchantId: 'merchant-1',
      supabase: supabase as never,
    });

    expect(maxActiveChanges).toBe(1);
  });

  it('does not emit public purge entries for 51 draft creations', async () => {
    const purgeEntries: StorefrontProductPurgeEntry[] = [];
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn((row: Record<string, unknown>) => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({
                data: { id: `created-${String(row.name)}` },
                error: null,
              })
            ),
          })),
        })),
      })),
    };

    const result = await processBulkUpdateChanges({
      changes: Array.from({ length: 51 }, (_, index) => ({
        type: 'new' as const,
        details: { name: `Draft Product ${index}`, price: index + 1 },
      })),
      currency: 'NGN',
      merchantBusinessName: 'Test Store',
      merchantId: 'merchant-1',
      onPurgeEntries: (entries) => purgeEntries.push(...entries),
      supabase: supabase as never,
    });

    expect(result.created).toBe(51);
    expect(purgeEntries).toEqual([]);
  });
});
