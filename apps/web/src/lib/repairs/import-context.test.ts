import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { loadImportMatchContext } from './import-context';

function tableClient(
  results: Record<string, { data: unknown; error: unknown }>
) {
  const from = vi.fn().mockImplementation((table: string) => {
    const result = results[table] ?? { data: [], error: null };
    // All three loaders now cap rows: .select().eq().limit()
    const limit = vi.fn().mockResolvedValue(result);
    const eq = vi.fn().mockReturnValue({ limit });
    return { select: vi.fn().mockReturnValue({ eq }) };
  });
  return { client: { from } as unknown as SupabaseClient, from };
}

describe('loadImportMatchContext', () => {
  it('loads devices, products and service types scoped to the merchant', async () => {
    const { client, from } = tableClient({
      repair_devices: {
        data: [
          {
            id: 'd-1',
            brand: 'Apple',
            model: 'iPhone 12',
            slug: 'apple-iphone-12',
            aliases: ['iphone twelve'],
            product_id: 'p-1',
          },
        ],
        error: null,
      },
      products: {
        data: [{ id: 'p-1', name: 'Apple iPhone 12', brand: 'Apple' }],
        error: null,
      },
      repair_service_types: {
        data: [{ id: 's-1', name: 'Screen Replacement' }],
        error: null,
      },
    });

    const context = await loadImportMatchContext(client, 'm-1');

    expect(from).toHaveBeenCalledWith('repair_devices');
    expect(from).toHaveBeenCalledWith('products');
    expect(from).toHaveBeenCalledWith('repair_service_types');
    expect(context.devices[0].productId).toBe('p-1');
    expect(context.products[0].brand).toBe('Apple');
    expect(context.serviceTypes[0].name).toBe('Screen Replacement');
  });

  it('throws when a query errors', async () => {
    const { client } = tableClient({
      repair_devices: { data: null, error: { message: 'boom' } },
    });
    await expect(loadImportMatchContext(client, 'm-1')).rejects.toThrow('boom');
  });
});
