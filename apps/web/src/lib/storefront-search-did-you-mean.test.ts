import { describe, expect, it, vi } from 'vitest';
import { logger } from './logger';
import type { StorefrontSearchSupabase } from './storefront-search';
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
    } satisfies StorefrontSearchSupabase;

    await expect(
      findStorefrontSearchDidYouMean({
        supabase,
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
    } satisfies StorefrontSearchSupabase;

    await expect(
      findStorefrontSearchDidYouMean({
        supabase,
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

  it('returns no suggestion and records a warning when the RPC rejects', async () => {
    const supabase = {
      rpc: vi.fn().mockRejectedValue(new Error('suggestion rpc rejected')),
    } satisfies StorefrontSearchSupabase;

    await expect(
      findStorefrontSearchDidYouMean({
        supabase,
        merchantId: MERCHANT_ID,
        query: 'iphon',
      })
    ).resolves.toBeNull();

    expect(logger.warn).toHaveBeenCalledWith({
      message: 'Search suggestion lookup failed; returning no suggestion',
      error: 'suggestion rpc rejected',
      merchantId: MERCHANT_ID,
      query: 'iphon',
    });
  });

  it.each([
    [null],
    ['iphone'],
    [{ suggested_term: 42 }],
  ])('returns no suggestion for a malformed RPC row: %j', async (row) => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: [row], error: null }),
    } satisfies StorefrontSearchSupabase;

    await expect(
      findStorefrontSearchDidYouMean({
        supabase,
        merchantId: MERCHANT_ID,
        query: 'iphon',
      })
    ).resolves.toBeNull();
  });
});
