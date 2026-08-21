import { describe, expect, it, vi } from 'vitest';
import {
  finalizeJumiaExportReservation,
  markJumiaExportReservationForReconciliation,
  releaseJumiaExportReservation,
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
    is: vi.fn(),
  };
  deleteBuilder.eq.mockImplementation((column: string, value: unknown) => {
    if (column === 'sync_status' && value === 'error') {
      return Promise.resolve({ error: options.deleteError ?? null });
    }
    return deleteBuilder;
  });
  deleteBuilder.is.mockReturnValue(deleteBuilder);
  deleteBuilder.in.mockReturnValue(deleteBuilder);
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

  it('clears all failed mappings for the product scope before reserving', async () => {
    const { from, del } = buildSupabase();

    await reserveJumiaExportMappings({
      ...baseArgs,
      exportVariations: [
        { sellerSku: 'SKU-NEW', price: 1500, currency: 'NGN' },
      ],
      variantIdsBySku: new Map([['SKU-NEW', 'variant-1']]),
      supabase: { from } as never,
    });

    expect(del).toHaveBeenCalled();
    const deleteBuilder = del.mock.results[0]?.value;
    expect(deleteBuilder.eq).toHaveBeenCalledWith('sync_status', 'error');
    expect(deleteBuilder.eq).not.toHaveBeenCalledWith(
      'variant_id',
      'variant-1'
    );
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

  it('retains the accepted feed ID when finalization is unrecoverable', async () => {
    const builder = {
      eq: vi.fn(),
      in: vi.fn().mockResolvedValue({ error: null }),
      is: vi.fn(),
    };
    builder.eq.mockReturnValue(builder);
    builder.is.mockReturnValue(builder);
    const update = vi.fn(() => builder);
    const from = vi.fn(() => ({ update }));

    await expect(
      markJumiaExportReservationForReconciliation({ from } as never, {
        merchantId: 'merchant-1',
        productId: 'product-1',
        shopId: 'shop-1',
        marketplaceKey: 'Jumia Nigeria',
        feedId: 'feed-accepted',
        exportVariations: [
          { sellerSku: 'SKU-1', price: 1500, currency: 'NGN' },
        ],
      })
    ).resolves.toBe(true);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_feed_id: 'feed-accepted',
        sync_status: 'pending',
      })
    );
  });

  it('reports when the accepted feed cannot be recorded for reconciliation', async () => {
    const builder = {
      eq: vi.fn(),
      in: vi.fn().mockResolvedValue({ error: { message: 'update failed' } }),
      is: vi.fn(),
    };
    builder.eq.mockReturnValue(builder);
    builder.is.mockReturnValue(builder);
    const from = vi.fn(() => ({ update: vi.fn(() => builder) }));

    await expect(
      markJumiaExportReservationForReconciliation({ from } as never, {
        merchantId: 'merchant-1',
        productId: 'product-1',
        shopId: 'shop-1',
        marketplaceKey: 'Jumia Nigeria',
        feedId: 'feed-accepted',
        exportVariations: [
          { sellerSku: 'SKU-1', price: 1500, currency: 'NGN' },
        ],
      })
    ).resolves.toBe(false);
  });
});

describe('releaseJumiaExportReservation', () => {
  it('returns true when pending reservations are deleted', async () => {
    const builder = {
      eq: vi.fn(),
      in: vi.fn(),
      is: vi.fn(),
    };
    builder.eq.mockReturnValue(builder);
    builder.is.mockReturnValue(builder);
    builder.in.mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ delete: vi.fn(() => builder) }));

    await expect(
      releaseJumiaExportReservation({ from } as never, {
        merchantId: 'merchant-1',
        productId: 'product-1',
        shopId: 'shop-1',
        marketplaceKey: 'Jumia Nigeria',
        exportVariations: [
          { sellerSku: 'SKU-1', price: 1500, currency: 'NGN' },
        ],
      })
    ).resolves.toBe(true);
  });

  it('marks pending reservations as error when delete fails', async () => {
    const deleteBuilder = {
      eq: vi.fn(),
      in: vi.fn(),
      is: vi.fn(),
    };
    deleteBuilder.eq.mockReturnValue(deleteBuilder);
    deleteBuilder.is.mockReturnValue(deleteBuilder);
    deleteBuilder.in.mockResolvedValue({
      error: { message: 'db unavailable' },
    });

    const updateBuilder = {
      eq: vi.fn(),
      in: vi.fn(),
      is: vi.fn(),
    };
    updateBuilder.eq.mockReturnValue(updateBuilder);
    updateBuilder.is.mockReturnValue(updateBuilder);
    updateBuilder.in.mockResolvedValue({ error: null });
    const update = vi.fn(() => updateBuilder);
    const from = vi.fn(() => ({
      delete: vi.fn(() => deleteBuilder),
      update,
    }));

    await expect(
      releaseJumiaExportReservation({ from } as never, {
        merchantId: 'merchant-1',
        productId: 'product-1',
        shopId: 'shop-1',
        marketplaceKey: 'Jumia Nigeria',
        exportVariations: [
          { sellerSku: 'SKU-1', price: 1500, currency: 'NGN' },
        ],
      })
    ).resolves.toBe(true);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        sync_status: 'error',
        sync_error: expect.stringContaining('db unavailable'),
      })
    );
  });
});
