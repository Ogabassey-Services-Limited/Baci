import { describe, expect, it, vi } from 'vitest';
import { upsertJumiaImportMappings } from './upsert-jumia-import-mappings';

describe('upsertJumiaImportMappings', () => {
  it('uses the marketplace-scoped mapping constraint', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn(() => ({ upsert })),
    };

    await upsertJumiaImportMappings({
      supabase: supabase as never,
      rows: [
        {
          merchant_id: 'merchant-1',
          product_id: 'product-1',
          variant_id: null,
          jumia_sku: 'SKU-1',
          jumia_seller_sku: 'SKU-1',
          jumia_shop_id: 'shop-ng',
          marketplace_key: 'NG',
          jumia_price: 100,
          jumia_product_id: 'jumia-1',
          is_active: true,
          sync_status: 'synced',
          last_synced_at: new Date(0).toISOString(),
        },
      ],
    });

    expect(upsert).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: 'product_id,variant_id,jumia_shop_id,marketplace_key',
    });
  });

  it('propagates mapping persistence errors', async () => {
    const error = { message: 'constraint failure' };
    const upsert = vi.fn().mockResolvedValue({ error });
    const supabase = { from: vi.fn(() => ({ upsert })) };

    const result = await upsertJumiaImportMappings({
      supabase: supabase as never,
      rows: [],
    });

    expect(result).toEqual({ error });
  });
});
