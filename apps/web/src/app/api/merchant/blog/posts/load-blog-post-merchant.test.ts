import { describe, expect, it, vi } from 'vitest';
import { loadBlogPostMerchant } from './load-blog-post-merchant';

function createSupabase(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { from, supabase: { from } };
}

describe('loadBlogPostMerchant', () => {
  it('returns merchant blog identifiers when the selected merchant exists', async () => {
    const { from, supabase } = createSupabase({
      data: { business_name: 'Baci Store', slug: 'baci-store' },
      error: null,
    });

    await expect(
      loadBlogPostMerchant({
        merchantId: 'merchant-1',
        supabase: supabase as never,
      })
    ).resolves.toEqual({
      businessName: 'Baci Store',
      kind: 'found',
      slug: 'baci-store',
    });
    expect(from).toHaveBeenCalledWith('merchants');
  });

  it('distinguishes an absent merchant from a database failure', async () => {
    const { supabase } = createSupabase({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    await expect(
      loadBlogPostMerchant({
        merchantId: 'merchant-1',
        supabase: supabase as never,
      })
    ).resolves.toEqual({ kind: 'not-found' });
  });
});
