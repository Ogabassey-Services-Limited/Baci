import { describe, expect, it, vi } from 'vitest';
import { logger } from './logger';
import { findStorefrontSearchDidYouMean } from './storefront-search-did-you-mean';

vi.mock('./logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('findStorefrontSearchDidYouMean', () => {
  it('returns the first ranked suggestion', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ suggested_term: 'iphone' }],
        error: null,
      }),
    };

    await expect(
      findStorefrontSearchDidYouMean({
        supabase: supabase as never,
        merchantId: MERCHANT_ID,
        query: 'iphon',
      })
    ).resolves.toBe('iphone');

    expect(supabase.rpc).toHaveBeenCalledWith(
      'find_product_search_suggestion_v2',
      {
        merchant_id_param: MERCHANT_ID,
        search_term: 'iphon',
      }
    );
  });

  it('returns no suggestion and records a warning when lookup fails', async () => {
    const lookupError = { message: 'suggestion rpc exploded' };
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: lookupError }),
    };

    await expect(
      findStorefrontSearchDidYouMean({
        supabase: supabase as never,
        merchantId: MERCHANT_ID,
        query: 'iphon',
      })
    ).resolves.toBeNull();

    expect(logger.warn).toHaveBeenCalledWith({
      message: 'Search suggestion lookup failed; returning no suggestion',
      error: 'suggestion rpc exploded',
      merchantId: MERCHANT_ID,
      query: 'iphon',
    });
  });
});
