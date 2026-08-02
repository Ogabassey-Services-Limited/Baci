import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMerchantRateQuotes } from './merchant-rate-quotes';

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111';
const ZONE_ID = '44444444-4444-4444-8444-444444444444';
const ROW_ZONE_ID = '77777777-7777-4777-8777-777777777777';
const RATE_ID = '55555555-5555-4555-8555-555555555555';
const TIER_RATE_ID = '66666666-6666-4666-8666-666666666666';

function buildRate(overrides: Record<string, unknown> = {}) {
  return {
    id: RATE_ID,
    zone_id: ZONE_ID,
    name: 'Lagos Standard',
    kind: 'ship',
    currency: 'NGN',
    base_amount: 1500,
    condition_type: 'always',
    min_subtotal: null,
    max_subtotal: null,
    free_over_amount: null,
    delivery_min_days: 1,
    delivery_max_days: 3,
    pickup_address: null,
    sort_order: 0,
    active: true,
    ...overrides,
  };
}

function buildPayload(overrides: Record<string, unknown> = {}) {
  return {
    zones: [
      { id: ZONE_ID, name: 'Lagos', is_rest_of_world: false, active: true },
    ],
    locations: [
      { zone_id: ZONE_ID, country_code: 'NG', subdivision_code: 'NG-LA' },
    ],
    rates: [buildRate()],
    ...overrides,
  };
}

function buildSupabase(rpcResult: unknown): SupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  } as unknown as SupabaseClient;
}

const input = {
  merchantId: MERCHANT_ID,
  receiverCountryCode: 'ng',
  receiverState: 'Lagos',
  merchantCurrency: 'NGN',
};

describe('getMerchantRateQuotes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps matched merchant rates onto the ShippingQuote shape', async () => {
    const supabase = buildSupabase({ data: buildPayload(), error: null });

    const { quotes } = await getMerchantRateQuotes(supabase, input);

    expect(supabase.rpc).toHaveBeenCalledWith('get_storefront_shipping_rates', {
      p_merchant_id: MERCHANT_ID,
    });
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      currency: 'NGN',
      estimatedDays: 2,
      id: `mrate_${RATE_ID}`,
      price: 1500,
      provider: 'MERCHANT',
    });
  });

  it('maps GIGL merchant settings to runtime provider codes', async () => {
    const supabase = buildSupabase({
      data: buildPayload({ shipping_providers: ['gigl'] }),
      error: null,
    });

    const result = await getMerchantRateQuotes(supabase, input);

    expect(result.enabledCarrierProviderCodes).toEqual(['GIGL']);
  });

  it('maps Topship merchant settings to runtime provider codes', async () => {
    const supabase = buildSupabase({
      data: buildPayload({ shipping_providers: ['topship'] }),
      error: null,
    });

    const result = await getMerchantRateQuotes(supabase, input);

    expect(result.enabledCarrierProviderCodes).toEqual(['TOPSHIP']);
  });

  it('drops unsupported provider ids instead of mapping them to Topship', async () => {
    const supabase = buildSupabase({
      data: buildPayload({ shipping_providers: ['gigl', 'future-carrier'] }),
      error: null,
    });

    const result = await getMerchantRateQuotes(supabase, input);

    expect(result.enabledCarrierProviderCodes).toEqual(['GIGL']);
  });

  it('keeps an explicit empty carrier provider list distinct from a load failure', async () => {
    const supabase = buildSupabase({
      data: buildPayload({ shipping_providers: [] }),
      error: null,
    });

    const result = await getMerchantRateQuotes(supabase, input);

    expect(result.enabledCarrierProviderCodes).toEqual([]);
    expect(result.loadFailed).toBeUndefined();
  });

  it('resolves free-text receiver states to subdivision codes for zone matching', async () => {
    const supabase = buildSupabase({
      data: buildPayload({
        locations: [
          { zone_id: ZONE_ID, country_code: 'NG', subdivision_code: 'NG-FC' },
        ],
      }),
      error: null,
    });

    const { quotes } = await getMerchantRateQuotes(supabase, {
      ...input,
      receiverState: 'FCT - Abuja',
    });

    expect(quotes).toHaveLength(1);
  });

  it('returns an empty list when no zone covers the destination', async () => {
    const supabase = buildSupabase({ data: buildPayload(), error: null });

    const { quotes } = await getMerchantRateQuotes(supabase, {
      ...input,
      receiverCountryCode: 'GH',
      receiverState: 'Accra',
    });

    expect(quotes).toEqual([]);
  });

  it('falls back to a rest-of-world zone for unmatched destinations', async () => {
    const supabase = buildSupabase({
      data: buildPayload({
        zones: [
          {
            id: ZONE_ID,
            name: 'Everywhere else',
            is_rest_of_world: true,
            active: true,
          },
        ],
        locations: [],
      }),
      error: null,
    });

    const { quotes } = await getMerchantRateQuotes(supabase, {
      ...input,
      receiverCountryCode: 'GH',
      receiverState: 'Accra',
    });

    expect(quotes).toHaveLength(1);
  });

  it('excludes price_tier rates and ignores free_over_amount without a subtotal', async () => {
    const supabase = buildSupabase({
      data: buildPayload({
        rates: [
          buildRate({
            id: TIER_RATE_ID,
            condition_type: 'price_tier',
            min_subtotal: 0,
            max_subtotal: 50_000,
          }),
          buildRate({ base_amount: 2000, free_over_amount: 50_000 }),
        ],
      }),
      error: null,
    });

    const { quotes } = await getMerchantRateQuotes(supabase, input);

    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({ id: `mrate_${RATE_ID}`, price: 2000 });
  });

  it('applies tier bounds and free_over_amount when a subtotal is provided', async () => {
    const supabase = buildSupabase({
      data: buildPayload({
        rates: [
          buildRate({
            id: TIER_RATE_ID,
            base_amount: 100,
            condition_type: 'price_tier',
            min_subtotal: 0,
            max_subtotal: 50_000,
          }),
          buildRate({
            base_amount: 2000,
            free_over_amount: 50_000,
            sort_order: 1,
          }),
        ],
      }),
      error: null,
    });

    const { quotes: withinTier } = await getMerchantRateQuotes(supabase, {
      ...input,
      cartSubtotal: 10_000,
    });
    const { quotes: aboveTier } = await getMerchantRateQuotes(supabase, {
      ...input,
      cartSubtotal: 60_000,
    });

    expect(withinTier).toHaveLength(2);
    expect(withinTier[0]).toMatchObject({
      id: `mrate_${TIER_RATE_ID}`,
      price: 100,
    });
    expect(aboveTier).toHaveLength(1);
    expect(aboveTier[0]).toMatchObject({ id: `mrate_${RATE_ID}`, price: 0 });
  });

  it('drops rates stamped in a currency other than the merchant current currency', async () => {
    // Arrange — one NGN rate, one stale USD rate; the store currency is NGN.
    const supabase = buildSupabase({
      data: buildPayload({
        rates: [
          buildRate(),
          buildRate({
            id: TIER_RATE_ID,
            currency: 'USD',
            base_amount: 10,
            sort_order: 1,
          }),
        ],
      }),
      error: null,
    });

    const { quotes } = await getMerchantRateQuotes(supabase, input);

    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      id: `mrate_${RATE_ID}`,
      currency: 'NGN',
    });
  });

  it('returns an empty list when every rate is in a stale currency', async () => {
    const supabase = buildSupabase({
      data: buildPayload({ rates: [buildRate({ currency: 'USD' })] }),
      error: null,
    });

    const { quotes } = await getMerchantRateQuotes(supabase, input);

    expect(quotes).toEqual([]);
  });

  it('prefers the RPC-returned currency over an NGN-default merchantCurrency for body-only callers', async () => {
    // A root-domain slug storefront (usebaci.com/{slug}/checkout) posts only a
    // body merchantId with no trusted x-merchant-slug header, so the route
    // cannot read the merchants table and passes the NGN platform default. The
    // definer RPC returns the merchant's real INR currency, so its INR rates
    // must survive the stale-currency filter instead of being dropped.
    const supabase = buildSupabase({
      data: {
        zones: [
          { id: ZONE_ID, name: 'India', is_rest_of_world: false, active: true },
        ],
        locations: [
          { zone_id: ZONE_ID, country_code: 'IN', subdivision_code: null },
        ],
        rates: [buildRate({ currency: 'INR', base_amount: 200 })],
        merchant_payout_currency: 'INR',
        merchant_country: 'IN',
      },
      error: null,
    });

    const { quotes } = await getMerchantRateQuotes(supabase, {
      merchantId: MERCHANT_ID,
      receiverCountryCode: 'IN',
      receiverState: null,
      merchantCurrency: 'NGN',
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      id: `mrate_${RATE_ID}`,
      currency: 'INR',
    });
  });

  it('still drops genuinely-stale rates using the RPC-returned currency', async () => {
    // The RPC says the store currency is INR; an NGN-stamped rate is stale and
    // must still be dropped (header/authenticated path stays correct).
    const supabase = buildSupabase({
      data: {
        zones: [
          { id: ZONE_ID, name: 'India', is_rest_of_world: false, active: true },
        ],
        locations: [
          { zone_id: ZONE_ID, country_code: 'IN', subdivision_code: null },
        ],
        rates: [
          buildRate({ currency: 'INR', base_amount: 200 }),
          buildRate({
            id: TIER_RATE_ID,
            currency: 'NGN',
            base_amount: 1500,
            sort_order: 1,
          }),
        ],
        merchant_payout_currency: 'INR',
        merchant_country: 'IN',
      },
      error: null,
    });

    const { quotes } = await getMerchantRateQuotes(supabase, {
      merchantId: MERCHANT_ID,
      receiverCountryCode: 'IN',
      receiverState: null,
      merchantCurrency: 'INR',
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      id: `mrate_${RATE_ID}`,
      currency: 'INR',
    });
  });

  it('exposes the RPC-resolved currency and country to the caller', async () => {
    // The definer RPC reports the merchant's real currency/country; the route
    // reads these to suppress NGN carriers for a body-only non-NG merchant.
    const supabase = buildSupabase({
      data: {
        zones: [
          { id: ZONE_ID, name: 'India', is_rest_of_world: false, active: true },
        ],
        locations: [
          { zone_id: ZONE_ID, country_code: 'IN', subdivision_code: null },
        ],
        rates: [buildRate({ currency: 'INR', base_amount: 200 })],
        merchant_payout_currency: 'INR',
        // Lower-case on purpose: the resolved country must be upper-cased.
        merchant_country: 'in',
      },
      error: null,
    });

    const result = await getMerchantRateQuotes(supabase, {
      merchantId: MERCHANT_ID,
      receiverCountryCode: 'IN',
      receiverState: null,
      merchantCurrency: 'NGN',
    });

    expect(result.quotes).toHaveLength(1);
    expect(result.resolvedCurrency).toBe('INR');
    expect(result.resolvedCountry).toBe('IN');
    // A successful RPC never flags a load failure.
    expect(result.loadFailed).toBeUndefined();
  });

  it('still exposes the resolved currency and country when no rate survives', async () => {
    // Non-NG merchant whose only rate is stale (NGN) — quotes empty, but the
    // route still needs the resolved country to suppress NGN carriers.
    const supabase = buildSupabase({
      data: {
        zones: [
          { id: ZONE_ID, name: 'India', is_rest_of_world: false, active: true },
        ],
        locations: [
          { zone_id: ZONE_ID, country_code: 'IN', subdivision_code: null },
        ],
        rates: [buildRate({ currency: 'NGN' })],
        merchant_payout_currency: 'INR',
        merchant_country: 'IN',
      },
      error: null,
    });

    const result = await getMerchantRateQuotes(supabase, {
      merchantId: MERCHANT_ID,
      receiverCountryCode: 'IN',
      receiverState: null,
      merchantCurrency: 'NGN',
    });

    expect(result.quotes).toEqual([]);
    expect(result.resolvedCurrency).toBe('INR');
    expect(result.resolvedCountry).toBe('IN');
  });

  it('leaves the resolved currency and country undefined when the RPC omits them', async () => {
    // Pre-migration RPC payload (no currency columns): nothing new is revealed,
    // so the route keeps its own resolution and the NG path stays byte-identical.
    const supabase = buildSupabase({ data: buildPayload(), error: null });

    const result = await getMerchantRateQuotes(supabase, input);

    expect(result.quotes).toHaveLength(1);
    expect(result.resolvedCurrency).toBeUndefined();
    expect(result.resolvedCountry).toBeUndefined();
  });

  it('ignores rates that belong to a different zone than the match', async () => {
    const supabase = buildSupabase({
      data: buildPayload({ rates: [buildRate({ zone_id: ROW_ZONE_ID })] }),
      error: null,
    });

    const { quotes } = await getMerchantRateQuotes(supabase, input);

    expect(quotes).toEqual([]);
  });

  it('fails closed with loadFailed when the RPC errors', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const supabase = buildSupabase({
      data: null,
      error: { message: 'permission denied' },
    });

    const {
      quotes,
      enabledCarrierProviderCodes,
      loadFailed,
      resolvedCurrency,
      resolvedCountry,
    } = await getMerchantRateQuotes(supabase, input);

    expect(quotes).toEqual([]);
    expect(enabledCarrierProviderCodes).toEqual([]);
    // The load failure is surfaced so the route can suppress NGN carriers.
    expect(loadFailed).toBe(true);
    // Nothing about the merchant's currency/country could be resolved.
    expect(resolvedCurrency).toBeUndefined();
    expect(resolvedCountry).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('fails closed with loadFailed when the client throws', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const supabase = {
      rpc: vi.fn(() => {
        throw new Error('client exploded');
      }),
    } as unknown as SupabaseClient;

    const { quotes, loadFailed } = await getMerchantRateQuotes(supabase, input);

    expect(quotes).toEqual([]);
    expect(loadFailed).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
  });
});
