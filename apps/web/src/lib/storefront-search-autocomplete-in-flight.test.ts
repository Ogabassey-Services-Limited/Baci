import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutocompleteSupabase } from './storefront-search-autocomplete';
import { withAutocompleteInFlightDeadline } from './storefront-search-autocomplete-in-flight';

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

type AbortableRankedQuery = PromiseLike<RankedRpcResult> & {
  abortSignal: (signal: AbortSignal) => AbortableRankedQuery;
  retry: (enabled: boolean) => AbortableRankedQuery;
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
      (
        fn: string,
        args: Record<string, unknown>
      ) => PromiseLike<RankedRpcResult>
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

  it('does not emit an unhandled rejection when the settlement observer throws', async () => {
    let unhandledRejection: unknown;
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejection = reason;
    };
    process.once('unhandledRejection', onUnhandledRejection);

    try {
      await expect(
        withAutocompleteInFlightDeadline(
          () => Promise.resolve('completed'),
          5_000,
          () => {
            throw new Error('settlement observer failed');
          }
        )
      ).resolves.toBe('completed');
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(unhandledRejection).toBeUndefined();
    } finally {
      process.removeListener('unhandledRejection', onUnhandledRejection);
    }
  });

  it('keeps coalescing a timed-out key while its transport remains unsettled', async () => {
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

    await expect(
      getStorefrontAutocompleteProducts({
        supabase,
        merchantId: MERCHANT_ID,
        query: 'hanging-lookup',
        limit: 10,
      })
    ).rejects.toMatchObject({
      code: '57014',
      name: 'AutocompleteInFlightTimeoutError',
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it('aborts cooperative ranked searches and disables their automatic retries on timeout', async () => {
    vi.useFakeTimers();
    const supabase = createAutocompleteSupabase();
    let boundSignal: AbortSignal | undefined;
    let rejectRankedSearch: ((reason?: unknown) => void) | undefined;
    const rankedSearch = new Promise<RankedRpcResult>((_resolve, reject) => {
      rejectRankedSearch = reject;
    });
    const abortableRankedSearch: AbortableRankedQuery = {
      abortSignal: vi.fn((signal) => {
        boundSignal = signal;
        signal.addEventListener('abort', () => {
          rejectRankedSearch?.(new Error('request aborted'));
        });
        return abortableRankedSearch;
      }),
      retry: vi.fn(() => abortableRankedSearch),
      // biome-ignore lint/suspicious/noThenProperty: thenable mock mirrors Supabase query builders
      then: (onFulfilled, onRejected) =>
        rankedSearch.then(onFulfilled, onRejected),
    };
    supabase.rpc.mockReturnValue(abortableRankedSearch);

    const pending = getStorefrontAutocompleteProducts({
      supabase,
      merchantId: MERCHANT_ID,
      query: 'cooperative-abort',
      limit: 10,
    });
    const result = pending.then(
      () => undefined,
      (error: unknown) => error
    );

    expect(abortableRankedSearch.abortSignal).toHaveBeenCalledTimes(1);
    expect(abortableRankedSearch.retry).toHaveBeenCalledWith(false);
    expect(boundSignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(5_001);

    await expect(result).resolves.toMatchObject({ code: '57014' });
    expect(boundSignal?.aborted).toBe(true);
  });

  it('keeps timed-out non-cooperative lookups at capacity until their transports settle', async () => {
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
    const settledPendingLookups = Promise.allSettled(pendingLookups);

    await vi.advanceTimersByTimeAsync(5_001);

    const timedOutResults = await settledPendingLookups;
    expect(timedOutResults).toHaveLength(256);
    expect(
      timedOutResults.every(
        (result) =>
          result.status === 'rejected' &&
          typeof result.reason === 'object' &&
          result.reason !== null &&
          'code' in result.reason &&
          result.reason.code === '57014'
      )
    ).toBe(true);

    await expect(
      getStorefrontAutocompleteProducts({
        supabase,
        merchantId: MERCHANT_ID,
        query: 'overflow-lookup',
        limit: 10,
      })
    ).rejects.toMatchObject({
      code: 'autocomplete_saturated',
      name: 'AutocompleteSaturationError',
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(256);

    resolveRankedSearch?.({ data: [], error: null });
    await vi.advanceTimersByTimeAsync(0);

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
