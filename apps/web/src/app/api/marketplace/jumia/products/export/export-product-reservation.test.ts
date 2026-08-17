import { describe, expect, it, vi } from 'vitest';
import {
  finalizeJumiaExportReservation,
  reserveJumiaExportMappings,
} from './export-product-reservation';

function buildSupabase(
  options: {
    existingMapping?: { id: string } | null;
    insertError?: { code: string } | null;
    deleteError?: { message: string } | null;
  } = {}
) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.existingMapping ?? null,
    error: null,
  });
  const insert = vi.fn().mockResolvedValue({
    error: options.insertError ?? null,
  });
  const deleteBuilder = {
    eq: vi.fn(),
    in: vi.fn(),
  };
  deleteBuilder.eq.mockReturnValue(deleteBuilder);
  deleteBuilder.in.mockResolvedValue({
    error: options.deleteError ?? null,
  });
  const del = vi.fn().mockReturnValue(deleteBuilder);

  const from = vi.fn((table: string) => {
    if (table === 'products') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'product-1' },
            error: null,
          }),
        })),
      };
    }

    return {
      select: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn(() => ({ maybeSingle })),
      })),
      insert,
      delete: del,
    };
  });

  return { from, insert, del };
}

const baseArgs = {
  merchantId: 'merchant-1',
  productId: 'product-1',
  shopId: 'shop-1',
  marketplaceKey: 'Jumia Nigeria',
  linkedProductId: 'product-1',
  variantIdsBySku: new Map([['SKU-1', 'variant-1']]),
  exportVariations: [{ sellerSku: 'SKU-1', price: 1500, currency: 'NGN' }],
};

describe('reserveJumiaExportMappings', () => {
  it('returns conflict when a non-error mapping already exists', async () => {
    const { from } = buildSupabase({ existingMapping: { id: 'mapping-1' } });

    const result = await reserveJumiaExportMappings({
      ...baseArgs,
      supabase: { from } as never,
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error:
        'This product is already mapped to Jumia for this integration. Update the existing listing instead.',
      code: 'jumia_mapping_exists',
    });
  });

  it('inserts pending mappings before Jumia createProduct runs', async () => {
    const { from, insert } = buildSupabase();

    const result = await reserveJumiaExportMappings({
      ...baseArgs,
      supabase: { from } as never,
    });

    expect(result).toEqual({
      ok: true,
      productId: 'product-1',
      variantIdsBySku: new Map([['SKU-1', 'variant-1']]),
    });
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        merchant_id: 'merchant-1',
        product_id: 'product-1',
        sync_status: 'pending',
        last_feed_id: null,
      }),
    ]);
  });

  it('clears previously failed mappings before inserting a retry reservation', async () => {
    const { from, del } = buildSupabase();

    await reserveJumiaExportMappings({
      ...baseArgs,
      supabase: { from } as never,
    });

    expect(del).toHaveBeenCalled();
    const deleteBuilder = del.mock.results[0]?.value;
    expect(deleteBuilder.in).not.toHaveBeenCalled();
  });

  it('maps unique violations to an in-progress conflict', async () => {
    const { from } = buildSupabase({ insertError: { code: '23505' } });

    const result = await reserveJumiaExportMappings({
      ...baseArgs,
      supabase: { from } as never,
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error:
        'This product export is already in progress or mapped for this integration.',
      code: 'jumia_mapping_exists',
    });
  });
});

describe('finalizeJumiaExportReservation', () => {
  it('retries once when the first feed-id persist fails', async () => {
    const inMock = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: 'write failed' } })
      .mockResolvedValueOnce({ error: null });
    const builder = {
      eq: vi.fn(),
      in: inMock,
    };
    builder.eq.mockReturnValue(builder);
    const from = vi.fn(() => ({
      update: vi.fn(() => builder),
    }));

    await expect(
      finalizeJumiaExportReservation({ from } as never, {
        merchantId: 'merchant-1',
        productId: 'product-1',
        shopId: 'shop-1',
        marketplaceKey: 'Jumia Nigeria',
        feedId: 'feed-1',
        exportVariations: [
          { sellerSku: 'SKU-1', price: 1500, currency: 'NGN' },
        ],
      })
    ).resolves.toBe(true);
    expect(inMock).toHaveBeenCalledTimes(2);
  });
});
