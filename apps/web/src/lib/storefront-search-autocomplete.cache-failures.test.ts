import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutocompleteSupabase } from './storefront-search-autocomplete.test-support';

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';

type GetStorefrontAutocompleteProducts =
  typeof import('./storefront-search-autocomplete').getStorefrontAutocompleteProducts;

describe('getStorefrontAutocompleteProducts cache failures', () => {
  let getStorefrontAutocompleteProducts: GetStorefrontAutocompleteProducts;

  beforeEach(async () => {
    vi.useRealTimers();
    vi.resetModules();
    const autocomplete = await import('./storefront-search-autocomplete');
    getStorefrontAutocompleteProducts =
      autocomplete.getStorefrontAutocompleteProducts;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('evicts the least recently used response when the cache reaches capacity', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T00:00:00.000Z'));
    const supabase = createAutocompleteSupabase();
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    for (let index = 0; index < 256; index++) {
      await getStorefrontAutocompleteProducts({
        supabase,
        merchantId: MERCHANT_ID,
        query: `lru-${index}`,
        limit: 10,
      });
    }

    await getStorefrontAutocompleteProducts({
      supabase,
      merchantId: MERCHANT_ID,
      query: 'lru-0',
      limit: 10,
    });
    await getStorefrontAutocompleteProducts({
      supabase,
      merchantId: MERCHANT_ID,
      query: 'lru-256',
      limit: 10,
    });
    await getStorefrontAutocompleteProducts({
      supabase,
      merchantId: MERCHANT_ID,
      query: 'lru-0',
      limit: 10,
    });
    await getStorefrontAutocompleteProducts({
      supabase,
      merchantId: MERCHANT_ID,
      query: 'lru-1',
      limit: 10,
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(258);
  });

  it('retries a rejected autocomplete lookup instead of retaining it in flight', async () => {
    const supabase = createAutocompleteSupabase();
    supabase.rpc
      .mockResolvedValueOnce({ data: null, error: new Error('search failed') })
      .mockResolvedValueOnce({
        data: [{ product_id: 'product-1', total_count: 1 }],
        error: null,
      });

    await expect(
      getStorefrontAutocompleteProducts({
        supabase,
        merchantId: MERCHANT_ID,
        query: 'iphone',
        limit: 10,
      })
    ).rejects.toThrow('search failed');

    await expect(
      getStorefrontAutocompleteProducts({
        supabase,
        merchantId: MERCHANT_ID,
        query: 'iphone',
        limit: 10,
      })
    ).resolves.toMatchObject({
      suggestions: [expect.objectContaining({ id: 'product-1' })],
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it('validates merchant ids before it can return a cached response', async () => {
    const supabase = createAutocompleteSupabase();
    supabase.rpc.mockResolvedValue({
      data: [{ product_id: 'product-1', total_count: 1 }],
      error: null,
    });

    await getStorefrontAutocompleteProducts({
      supabase,
      merchantId: MERCHANT_ID,
      query: 'iphone',
      limit: 10,
    });

    await expect(
      getStorefrontAutocompleteProducts({
        supabase,
        merchantId: 'not-a-uuid',
        query: 'iphone',
        limit: 10,
      })
    ).rejects.toThrow('Invalid merchant_id format');

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it('caches zero-result responses without a did-you-mean lookup', async () => {
    const supabase = createAutocompleteSupabase();
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    const first = await getStorefrontAutocompleteProducts({
      supabase,
      merchantId: MERCHANT_ID,
      query: 'zzzz',
      limit: 10,
    });
    const second = await getStorefrontAutocompleteProducts({
      supabase,
      merchantId: MERCHANT_ID,
      query: 'zzzz',
      limit: 10,
    });

    expect(first).toEqual({ suggestions: [], popularSearches: [] });
    expect(second).toEqual(first);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
