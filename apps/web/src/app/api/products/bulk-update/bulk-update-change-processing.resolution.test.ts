import { describe, expect, it, vi } from 'vitest';
import { processBulkUpdateChanges } from './bulk-update-change-processing';

function resolvedQuery(data: unknown[]) {
  const query: Record<string, unknown> = {};
  query.eq = vi.fn(() => query);
  query.select = vi.fn(() => query);
  // biome-ignore lint/suspicious/noThenProperty: Supabase builders are thenable.
  query.then = vi.fn(
    (resolve: (value: { data: unknown[]; error: null }) => void) =>
      resolve({ data, error: null })
  );
  return query;
}

describe('processBulkUpdateChanges resolved product ids', () => {
  it('reports the archived id for a remove change', async () => {
    const productId = '123e4567-e89b-12d3-a456-426614174000';
    const previousQuery = resolvedQuery([
      { id: productId, slug: 'phone-16', category: 'Smartphones' },
    ]);
    const archiveQuery = resolvedQuery([
      { id: productId, slug: 'phone-16', category: 'Smartphones' },
    ]);
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce({ select: vi.fn(() => previousQuery) })
        .mockReturnValueOnce({ update: vi.fn(() => archiveQuery) }),
    };
    const onResolvedProductIds = vi.fn();

    const result = await processBulkUpdateChanges({
      changes: [
        {
          type: 'remove',
          productId,
          details: { name: 'Phone 16', price: 200 },
        },
      ],
      currency: 'NGN',
      merchantBusinessName: 'Test Store',
      merchantId: 'merchant-1',
      onResolvedProductIds,
      supabase: supabase as never,
    });

    expect(result).toEqual({ updated: 0, created: 0, removed: 1, errors: [] });
    expect(onResolvedProductIds).toHaveBeenCalledWith([productId]);
  });

  it('reports an empty id list when an update returns no rows', async () => {
    const previousQuery = resolvedQuery([]);
    const updateQuery = resolvedQuery([]);
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce({ select: vi.fn(() => previousQuery) })
        .mockReturnValueOnce({ update: vi.fn(() => updateQuery) }),
    };
    const onResolvedProductIds = vi.fn();

    const result = await processBulkUpdateChanges({
      changes: [
        {
          type: 'update',
          productId: '123e4567-e89b-12d3-a456-426614174000',
          newPrice: 200,
          details: { name: 'Missing Phone', price: 200 },
        },
      ],
      currency: 'NGN',
      merchantBusinessName: 'Test Store',
      merchantId: 'merchant-1',
      onResolvedProductIds,
      supabase: supabase as never,
    });

    expect(result).toEqual({ updated: 1, created: 0, removed: 0, errors: [] });
    expect(onResolvedProductIds).toHaveBeenCalledWith([]);
  });
});
