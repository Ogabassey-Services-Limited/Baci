import { describe, expect, it, vi } from 'vitest';
import { loadVariantProductIds } from './load-variant-product-ids';

describe('loadVariantProductIds', () => {
  it('returns distinct valid product IDs across paged variant matches', async () => {
    const range = vi.fn().mockResolvedValueOnce({
      data: [
        { product_id: '00000000-0000-4000-8000-000000000001' },
        { product_id: '00000000-0000-4000-8000-000000000001' },
        { product_id: 'not-a-uuid' },
      ],
      error: null,
    });
    const ilike = vi.fn(() => ({ range }));
    const eq = vi.fn(() => ({ ilike }));
    const select = vi.fn(() => ({ eq }));
    const supabase = { from: vi.fn(() => ({ select })) };

    const result = await loadVariantProductIds(
      supabase as never,
      'merchant-1',
      'SKU_%'
    );

    expect(result).toEqual(['00000000-0000-4000-8000-000000000001']);
    expect(supabase.from).toHaveBeenCalledWith('product_variants');
    expect(eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(ilike).toHaveBeenCalledWith('sku', '%SKU\\_\\%%');
    expect(range).toHaveBeenCalledWith(0, 999);
  });

  it('propagates variant query errors', async () => {
    const error = new Error('query failed');
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            ilike: vi.fn(() => ({
              range: vi.fn().mockResolvedValue({ data: null, error }),
            })),
          })),
        })),
      })),
    };

    await expect(
      loadVariantProductIds(supabase as never, 'merchant-1', 'sku')
    ).rejects.toThrow('query failed');
  });
});
