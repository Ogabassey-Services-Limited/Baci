import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockScheduleStorefrontProductPurge = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('@/lib/storefront-product-purge', () => ({
  scheduleStorefrontProductPurge: (...args: unknown[]) =>
    mockScheduleStorefrontProductPurge(...args),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

import { scheduleStorefrontInventoryProductPurge } from '@/lib/storefront-inventory-product-purge';

function createSupabase({
  merchant = { slug: 'ogabassey' },
  merchantError = null,
}: {
  merchant?: { slug: string | null } | null;
  merchantError?: unknown;
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: merchant,
    error: merchantError,
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));

  return {
    from: vi.fn((table: string) => {
      if (table !== 'merchants') {
        throw new Error(`Unexpected table ${table}`);
      }
      return { select };
    }),
  };
}

describe('scheduleStorefrontInventoryProductPurge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('schedules canonical PDP and listing purge entries for inventory-changing products', async () => {
    const supabase = createSupabase();

    await scheduleStorefrontInventoryProductPurge({
      merchantId: 'merchant-1',
      operation: 'order creation',
      products: [
        {
          category: 'Smartphones',
          id: 'product-1',
          slug: 'iphone-15',
        },
      ],
      supabase: supabase as never,
    });

    expect(mockScheduleStorefrontProductPurge).toHaveBeenCalledWith(
      'ogabassey',
      [{ slug: 'iphone-15', categorySegment: 'smartphones' }]
    );
  });

  it('falls back to the product id for legacy rows without a slug', async () => {
    const supabase = createSupabase();

    await scheduleStorefrontInventoryProductPurge({
      merchantId: 'merchant-1',
      operation: 'inventory reclaim',
      products: [{ category: 'Audio', id: 'legacy-product', slug: null }],
      supabase: supabase as never,
    });

    expect(mockScheduleStorefrontProductPurge).toHaveBeenCalledWith(
      'ogabassey',
      [{ slug: 'legacy-product', categorySegment: 'audio' }]
    );
  });

  it('uses a server-resolved merchant slug without an additional database lookup', async () => {
    const supabase = { from: vi.fn() };

    await scheduleStorefrontInventoryProductPurge({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      operation: 'order creation',
      products: [{ id: 'product-1', slug: 'iphone-15' }],
      supabase: supabase as never,
    });

    expect(supabase.from).not.toHaveBeenCalled();
    expect(mockScheduleStorefrontProductPurge).toHaveBeenCalledWith(
      'ogabassey',
      [{ slug: 'iphone-15', categorySegment: null }]
    );
  });

  it('fails open when the merchant slug lookup fails', async () => {
    const supabase = createSupabase({ merchantError: { message: 'db down' } });

    await expect(
      scheduleStorefrontInventoryProductPurge({
        merchantId: 'merchant-1',
        operation: 'order cancellation',
        products: [{ id: 'product-1', slug: 'iphone-15' }],
        supabase: supabase as never,
      })
    ).resolves.toBeUndefined();

    expect(mockScheduleStorefrontProductPurge).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        operation: 'order cancellation',
      })
    );
  });
});
