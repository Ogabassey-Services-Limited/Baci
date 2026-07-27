import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAutocompleteSupabase,
  type RankedRpcResult,
} from './storefront-search-autocomplete.test-support';
import { withAutocompleteInFlightDeadline } from './storefront-search-autocomplete-in-flight';

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';

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

  it('releases successful requests instead of eventually reporting false saturation', async () => {
    const supabase = createAutocompleteSupabase();
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    for (let index = 0; index < 257; index += 1) {
      await expect(
        getStorefrontAutocompleteProducts({
          supabase,
          merchantId: MERCHANT_ID,
          query: `completed-${index}`,
          limit: 10,
        })
      ).resolves.toEqual({ suggestions: [], popularSearches: [] });
    }

    expect(supabase.rpc).toHaveBeenCalledTimes(257);
  });
});
