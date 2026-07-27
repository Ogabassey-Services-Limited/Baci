import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('bugfix: bounded autocomplete in-flight requests', () => {
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

  it('releases a never-settling lookup after the in-flight deadline', async () => {
    vi.useFakeTimers();
    const supabase = createAutocompleteSupabase();
    supabase.rpc.mockReturnValue(new Promise<RankedRpcResult>(() => undefined));

    const hangingLookup = getStorefrontAutocompleteProducts({
      supabase,
      merchantId: MERCHANT_ID,
      query: 'hanging-lookup',
      limit: 10,
    });
    let rejection: unknown;
    void hangingLookup.catch((error: unknown) => {
      rejection = error;
    });

    await vi.advanceTimersByTimeAsync(5_001);

    expect(rejection).toMatchObject({
      code: '57014',
      name: 'AutocompleteInFlightTimeoutError',
    });

    supabase.rpc.mockResolvedValue({ data: [], error: null });
    await expect(
      getStorefrontAutocompleteProducts({
        supabase,
        merchantId: MERCHANT_ID,
        query: 'hanging-lookup',
        limit: 10,
      })
    ).resolves.toEqual({ suggestions: [], popularSearches: [] });
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it('rejects overflow without starting an RPC and admits work after capacity releases', async () => {
    vi.useFakeTimers();
    const supabase = createAutocompleteSupabase();
    let resolveRankedSearch: ((result: RankedRpcResult) => void) | undefined;
    const rankedSearch = new Promise<RankedRpcResult>((resolve) => {
      resolveRankedSearch = resolve;
    });
    supabase.rpc.mockReturnValue(rankedSearch);

    const pendingLookups = Array.from({ length: 256 }, (_, index) =>
      getStorefrontAutocompleteProducts({
        supabase,
        merchantId: MERCHANT_ID,
        query: `pending-${index}`,
        limit: 10,
      })
    );
    const overflow = getStorefrontAutocompleteProducts({
      supabase,
      merchantId: MERCHANT_ID,
      query: 'overflow-lookup',
      limit: 10,
    });
    let overflowRejection: unknown;
    void overflow.catch((error: unknown) => {
      overflowRejection = error;
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(overflowRejection).toMatchObject({
      code: '57014',
      name: 'AutocompleteInFlightTimeoutError',
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(256);

    resolveRankedSearch?.({ data: [], error: null });
    await Promise.all(pendingLookups);

    await expect(
      getStorefrontAutocompleteProducts({
        supabase,
        merchantId: MERCHANT_ID,
        query: 'admitted-after-release',
        limit: 10,
      })
    ).resolves.toEqual({ suggestions: [], popularSearches: [] });
    expect(supabase.rpc).toHaveBeenCalledTimes(257);
  });
});
