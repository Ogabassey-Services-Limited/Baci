import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutocompleteSupabase } from './storefront-search-autocomplete';

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';

type RankedRpcResult = {
  data: Array<{ product_id: string; total_count: number }> | null;
  error: Error | null;
};

type ProductQuery = PromiseLike<{
  data: Array<{
    id: string;
    name: string;
    category: string | null;
    price: number;
    images: string[];
    slug: string;
  }>;
  error: null;
}> & {
  in: (column: string, values: string[]) => ProductQuery;
  eq: (column: string, value: string) => ProductQuery;
};

function createAutocompleteSupabase() {
  const query: ProductQuery = {
    in: vi.fn(() => query),
    eq: vi.fn(() => query),
    // biome-ignore lint/suspicious/noThenProperty: thenable mock mirrors Supabase query builders
    then: (onFulfilled, onRejected) =>
      Promise.resolve({
        data: [
          {
            id: 'product-1',
            name: 'iPhone 16 Pro',
            category: 'Phones',
            price: 1_200_000,
            images: ['https://cdn.example.com/iphone.jpg'],
            slug: 'iphone-16-pro',
          },
        ],
        error: null,
      }).then(onFulfilled, onRejected),
  };

  return {
    from: vi.fn(() => ({ select: vi.fn(() => query) })),
    rpc: vi.fn<
      (fn: string, args: Record<string, unknown>) => Promise<RankedRpcResult>
    >(),
  } satisfies AutocompleteSupabase;
}

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

  it('evicts the least recently used response when the cache reaches capacity', async () => {
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
