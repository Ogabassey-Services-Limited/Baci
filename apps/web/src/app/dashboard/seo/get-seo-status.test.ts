import { describe, expect, it, vi } from 'vitest';
import { getSEOStatusForMerchant } from './get-seo-status';

function createSupabase(products: unknown[] | null, error: unknown = null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    data: products,
    error,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { supabase: { from: vi.fn(() => query) } as never, query };
}

describe('getSEOStatusForMerchant', () => {
  it('calculates the summary from active products scoped to the authorized merchant', async () => {
    const { supabase, query } = createSupabase([
      {
        id: 'product-1',
        name: 'Leather Tote Bag',
        description: 'A leather tote bag for work and everyday use.',
        meta_title: null,
        meta_description: null,
        keywords: [],
      },
    ]);

    const result = await getSEOStatusForMerchant(supabase, 'merchant-1');

    expect(query.eq).toHaveBeenNthCalledWith(1, 'merchant_id', 'merchant-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'status', 'active');
    expect(result.summary?.totalProducts).toBe(1);
    expect(result.products[0]?.productId).toBe('product-1');
  });

  it('throws when the active-product query fails', async () => {
    const { supabase } = createSupabase(null, {
      message: 'database unavailable',
    });

    await expect(
      getSEOStatusForMerchant(supabase, 'merchant-1')
    ).rejects.toThrow('Failed to fetch products');
  });
});
