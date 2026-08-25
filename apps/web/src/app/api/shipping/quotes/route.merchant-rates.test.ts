import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateAdminClient = vi.fn();
const mockCreateServerClient = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockGetQuotes = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateServerClient,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mockGetMerchantForApiRequest,
  toUserAccess: vi.fn((context: unknown) => context),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/lib/shipping', () => ({
  shippingService: {
    getQuotes: mockGetQuotes,
  },
}));

const ZONE_ID = '44444444-4444-4444-8444-444444444444';
const RATE_ID = '55555555-5555-4555-8555-555555555555';
const TIER_RATE_ID = '66666666-6666-4666-8666-666666666666';
const GIGL_QUOTE_ID = '33333333-3333-4333-8333-333333333333';

const EMPTY_RATES_PAYLOAD = { locations: [], rates: [], zones: [] };

function buildRate(overrides: Record<string, unknown> = {}) {
  return {
    id: RATE_ID,
    zone_id: ZONE_ID,
    name: 'Standard Delivery',
    kind: 'ship',
    currency: 'NGN',
    base_amount: 1500,
    condition_type: 'always',
    min_subtotal: null,
    max_subtotal: null,
    free_over_amount: null,
    delivery_min_days: null,
    delivery_max_days: null,
    pickup_address: null,
    sort_order: 0,
    active: true,
    ...overrides,
  };
}

const lagosRatesPayload = {
  zones: [
    { id: ZONE_ID, name: 'Lagos', is_rest_of_world: false, active: true },
  ],
  locations: [
    { zone_id: ZONE_ID, country_code: 'NG', subdivision_code: 'NG-LA' },
  ],
  rates: [buildRate()],
};

const indiaRatesPayload = {
  zones: [
    { id: ZONE_ID, name: 'India', is_rest_of_world: false, active: true },
  ],
  locations: [{ zone_id: ZONE_ID, country_code: 'IN', subdivision_code: null }],
  rates: [buildRate({ currency: 'INR', base_amount: 200 })],
};

const indiaTieredRatesPayload = {
  ...indiaRatesPayload,
  rates: [
    buildRate({
      id: TIER_RATE_ID,
      name: 'Small Order Delivery',
      currency: 'INR',
      base_amount: 100,
      condition_type: 'price_tier',
      min_subtotal: 0,
      max_subtotal: 50_000,
    }),
    buildRate({
      currency: 'INR',
      base_amount: 2000,
      free_over_amount: 50_000,
      sort_order: 1,
    }),
  ],
};

const giglQuote = {
  id: GIGL_QUOTE_ID,
  provider: 'GIGL' as const,
  serviceTier: 'Standard',
  carrierName: 'GIG Logistics',
  displayName: 'GIG Logistics',
  estimatedDays: 3,
  price: 5000,
  currency: 'NGN',
  pickupIncluded: true,
  insuranceIncluded: true,
  expiresAt: new Date(Date.now() + 60_000),
};

interface SupabaseMockOptions {
  /** When true, the merchant-rate RPC resolves an error (a load failure). */
  rpcError?: boolean;
}

function buildSupabaseMock(
  merchantDetails: Record<string, unknown>,
  ratesPayload: unknown = EMPTY_RATES_PAYLOAD,
  options: SupabaseMockOptions = {}
) {
  const shippingQuotesTable = {
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
  const merchantSelect = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: merchantDetails,
      error: null,
    }),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return { select: vi.fn(() => merchantSelect) };
      }
      if (table === 'shipping_quotes') {
        return shippingQuotesTable;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: options.rpcError
      ? vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'rate rpc failed' },
        })
      : vi.fn().mockResolvedValue({ data: ratesPayload, error: null }),
    shippingQuotesTable,
  };
}

function buildDomesticRequest(
  overrides: Record<string, unknown> = {}
): NextRequest {
  return new Request('https://usebaci.com/api/shipping/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shipmentType: 'domestic',
      receiver: {
        name: 'Jane Receiver',
        address: '12 Allen Avenue',
        city: 'Ikeja',
        state: 'Lagos',
      },
      items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
      ...overrides,
    }),
  }) as unknown as NextRequest;
}

// India destination for a capable client. `supports_merchant_rates: true`
// opts the request into merchant-configured rates, which are the only quote
// source for a non-NG merchant.
const indiaReceiver = {
  name: 'Jane Receiver',
  address: '12 MG Road',
  city: 'Mumbai',
  state: 'Maharashtra',
  country: 'India',
  countryCode: 'IN',
};

const indiaReceiverOverride = {
  receiver: indiaReceiver,
  supports_merchant_rates: true,
};

const NG_MERCHANT = {
  business_name: 'Merchant Store',
  business_address: '1 Merchant Road, Lagos',
  phone: '08012345678',
  country: 'NG',
  payout_currency: 'NGN',
};

const IN_MERCHANT = {
  business_name: 'Mumbai Store',
  business_address: '1 MG Road, Mumbai',
  phone: '+919876543210',
  country: 'IN',
  payout_currency: 'INR',
};

async function postQuotes(
  merchantDetails: Record<string, unknown>,
  ratesPayload: unknown,
  overrides: Record<string, unknown> = {},
  options: SupabaseMockOptions = {}
) {
  const supabase = buildSupabaseMock(merchantDetails, ratesPayload, options);
  mockCreateAdminClient.mockReturnValue(supabase);
  mockCreateServerClient.mockResolvedValue(supabase);
  const { POST } = await import('./route');

  const response = await POST(buildDomesticRequest(overrides));
  return { json: await response.json(), response, supabase };
}

describe('POST /api/shipping/quotes merchant-configured rates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMerchantForApiRequest.mockResolvedValue({
      businessName: 'Merchant Store',
      merchantId: 'merchant-1',
    });
    mockGetQuotes.mockResolvedValue({
      quotes: { featured: [giglQuote], all: [giglQuote] },
      sessionId: 'session-1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
  });

  it('merges merchant rates with carrier quotes for an NG merchant and never persists them', async () => {
    const { json, response, supabase } = await postQuotes(
      NG_MERCHANT,
      lagosRatesPayload,
      { supports_merchant_rates: true }
    );

    expect(response.status).toBe(200);
    expect(mockGetQuotes).toHaveBeenCalled();
    expect(json.quotes.all).toHaveLength(2);
    expect(json.quotes.all).toContainEqual(
      expect.objectContaining({ id: GIGL_QUOTE_ID, provider: 'GIGL' })
    );
    expect(json.quotes.all).toContainEqual(
      expect.objectContaining({
        currency: 'NGN',
        id: `mrate_${RATE_ID}`,
        price: 1500,
        provider: 'MERCHANT',
      })
    );

    // Persistence: only the carrier quote row is upserted.
    expect(supabase.shippingQuotesTable.upsert).toHaveBeenCalledTimes(1);
    expect(supabase.shippingQuotesTable.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: GIGL_QUOTE_ID, provider: 'GIGL' }),
      { onConflict: 'id' }
    );
  });

  it('re-buckets featured picks after merging and never marks a 0-estimate merchant rate as fastest', async () => {
    const { json } = await postQuotes(NG_MERCHANT, lagosRatesPayload, {
      supports_merchant_rates: true,
    });

    // The merchant rate (no configured days => estimatedDays 0) wins cheapest.
    const economy = json.quotes.featured.find((quote: { id: string }) =>
      quote.id.startsWith('mrate_')
    );
    expect(economy).toMatchObject({ estimatedDays: 0, price: 1500 });

    // The fastest badge goes to the carrier quote, never the 0-day sentinel.
    const express = json.quotes.featured.find(
      (quote: { displayName: string }) =>
        quote.displayName.includes('Express Delivery')
    );
    expect(express).toMatchObject({ id: GIGL_QUOTE_ID, estimatedDays: 3 });
  });

  it('returns merchant-only quotes without warnings for an IN merchant with rates and never calls carriers', async () => {
    const { json, response, supabase } = await postQuotes(
      IN_MERCHANT,
      indiaRatesPayload,
      indiaReceiverOverride
    );

    expect(response.status).toBe(200);
    expect(mockGetQuotes).not.toHaveBeenCalled();
    expect(json.quotes.all).toEqual([
      expect.objectContaining({
        currency: 'INR',
        id: `mrate_${RATE_ID}`,
        price: 200,
        provider: 'MERCHANT',
      }),
    ]);
    expect(json.quotes.featured.length).toBeGreaterThan(0);
    expect(json.warnings).toBeUndefined();
    expect(supabase.shippingQuotesTable.upsert).not.toHaveBeenCalled();
  });

  it('returns empty quotes with the unavailable warning for an IN merchant with no configured rates', async () => {
    const { json, response } = await postQuotes(
      IN_MERCHANT,
      EMPTY_RATES_PAYLOAD,
      indiaReceiverOverride
    );

    expect(response.status).toBe(200);
    expect(mockGetQuotes).not.toHaveBeenCalled();
    expect(json.quotes).toEqual({ featured: [], all: [] });
    expect(
      json.warnings.some(
        (warning: string) =>
          /Nigerian merchants only/i.test(warning) &&
          /has not configured/i.test(warning)
      )
    ).toBe(true);
  });

  it('excludes price_tier rates and ignores free_over_amount when cart_subtotal is absent', async () => {
    const { json } = await postQuotes(
      IN_MERCHANT,
      indiaTieredRatesPayload,
      indiaReceiverOverride
    );

    expect(json.quotes.all).toHaveLength(1);
    expect(json.quotes.all[0]).toMatchObject({
      id: `mrate_${RATE_ID}`,
      price: 2000,
    });
  });

  it('includes an in-bounds price_tier rate when cart_subtotal is provided', async () => {
    const { json } = await postQuotes(IN_MERCHANT, indiaTieredRatesPayload, {
      ...indiaReceiverOverride,
      cart_subtotal: 10_000,
    });

    expect(json.quotes.all).toHaveLength(2);
    expect(json.quotes.all).toContainEqual(
      expect.objectContaining({ id: `mrate_${TIER_RATE_ID}`, price: 100 })
    );
    expect(json.quotes.all).toContainEqual(
      expect.objectContaining({ id: `mrate_${RATE_ID}`, price: 2000 })
    );
  });

  it('drops out-of-bounds price_tier rates and applies free_over_amount when cart_subtotal qualifies', async () => {
    const { json } = await postQuotes(IN_MERCHANT, indiaTieredRatesPayload, {
      ...indiaReceiverOverride,
      cart_subtotal: 60_000,
    });

    expect(json.quotes.all).toHaveLength(1);
    expect(json.quotes.all[0]).toMatchObject({
      id: `mrate_${RATE_ID}`,
      price: 0,
    });
  });

  it('keeps the carrier-only response identical when a capable NG merchant has no configured rates', async () => {
    const { json, supabase } = await postQuotes(
      NG_MERCHANT,
      EMPTY_RATES_PAYLOAD,
      { supports_merchant_rates: true }
    );

    expect(mockGetQuotes).toHaveBeenCalled();
    expect(json.quotes.all).toEqual([
      expect.objectContaining({ id: GIGL_QUOTE_ID, provider: 'GIGL' }),
    ]);
    expect(json.quotes.featured).toEqual([
      expect.objectContaining({ id: GIGL_QUOTE_ID }),
    ]);
    expect(json.warnings).toBeUndefined();
    expect(supabase.shippingQuotesTable.upsert).toHaveBeenCalledTimes(1);
  });

  it('excludes merchant rates but keeps carrier quotes for an NG merchant when supports_merchant_rates is absent', async () => {
    // No flag: the caller cannot thread mrate_ ids back into order creation, so
    // merchant rates must not appear even though the merchant configured them.
    const { json, response, supabase } = await postQuotes(
      NG_MERCHANT,
      lagosRatesPayload
    );

    expect(response.status).toBe(200);
    expect(mockGetQuotes).toHaveBeenCalled();
    expect(json.quotes.all).toEqual([
      expect.objectContaining({ id: GIGL_QUOTE_ID, provider: 'GIGL' }),
    ]);
    expect(
      json.quotes.all.some((quote: { id: string }) =>
        quote.id.startsWith('mrate_')
      )
    ).toBe(false);
    expect(
      json.quotes.featured.some((quote: { id: string }) =>
        quote.id.startsWith('mrate_')
      )
    ).toBe(false);
    expect(json.warnings).toBeUndefined();
    // Byte-identical carrier-only persistence.
    expect(supabase.shippingQuotesTable.upsert).toHaveBeenCalledTimes(1);
  });

  it('excludes merchant rates for a non-NG merchant when supports_merchant_rates is absent', async () => {
    // Non-NG merchant with configured INR rates, but the caller did not opt in:
    // carriers are skipped (NGN-only) and merchant rates are gated off, so the
    // response falls through to the empty + unavailable-warning path.
    const { json, response } = await postQuotes(
      IN_MERCHANT,
      indiaRatesPayload,
      { receiver: indiaReceiver }
    );

    expect(response.status).toBe(200);
    expect(mockGetQuotes).not.toHaveBeenCalled();
    expect(json.quotes).toEqual({ featured: [], all: [] });
    expect(
      json.warnings.some((warning: string) =>
        /Nigerian merchants only/i.test(warning)
      )
    ).toBe(true);
  });

  it('still returns carrier quotes for an NG merchant when the merchant-rate RPC errors', async () => {
    // The rate RPC fails (load failure), but the NG merchant's currency/country
    // came from trusted (authenticated) context, so the fail-closed guard does
    // not fire: carriers are still merged and persisted, and no merchant rate
    // leaks from the failed load.
    const { json, response, supabase } = await postQuotes(
      NG_MERCHANT,
      lagosRatesPayload,
      { supports_merchant_rates: true },
      { rpcError: true }
    );

    expect(response.status).toBe(200);
    expect(mockGetQuotes).toHaveBeenCalled();
    expect(json.quotes.all).toEqual([
      expect.objectContaining({ id: GIGL_QUOTE_ID, provider: 'GIGL' }),
    ]);
    expect(
      json.quotes.all.some((quote: { id: string }) =>
        quote.id.startsWith('mrate_')
      )
    ).toBe(false);
    expect(json.warnings).toBeUndefined();
    expect(supabase.shippingQuotesTable.upsert).toHaveBeenCalledTimes(1);
  });

  it('returns the empty + unavailable-rates response for a non-NG merchant when the merchant-rate RPC errors', async () => {
    // A non-NG merchant already skips the Nigerian carriers, so a failed rate
    // load leaves nothing to offer: the empty merchant-only response with the
    // unavailable warning, and carriers are never called.
    const { json, response } = await postQuotes(
      IN_MERCHANT,
      indiaRatesPayload,
      indiaReceiverOverride,
      { rpcError: true }
    );

    expect(response.status).toBe(200);
    expect(mockGetQuotes).not.toHaveBeenCalled();
    expect(json.quotes).toEqual({ featured: [], all: [] });
    expect(
      json.warnings.some(
        (warning: string) =>
          /Nigerian merchants only/i.test(warning) &&
          /has not configured/i.test(warning)
      )
    ).toBe(true);
  });
});

// R14-1: on the BODY-ONLY path (root-domain slug checkout — merchantId in the
// body, no trusted x-merchant-slug header and no authenticated session) the
// route cannot read the merchants table, so the SECURITY DEFINER RPC is the
// ONLY currency-discovery path. The merchant-rate load must therefore run even
// for a client that CANNOT handle merchant rates
// (`supports_merchant_rates: false`), so the NGN-only carriers are suppressed
// for a non-NG merchant. The unbookable mrate_ quotes are still withheld from
// the incapable client.
const BODY_MERCHANT_ID = '99999999-9999-4999-8999-999999999999';

const indiaRatesPayloadWithCurrency = {
  ...indiaRatesPayload,
  merchant_payout_currency: 'INR',
  merchant_country: 'IN',
};

function buildBodyOnlySupabaseMock(ratesPayload: unknown) {
  const shippingQuotesTable = {
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };

  return {
    // No authenticated user: the merchant is resolved from the body id only, so
    // there is no trusted currency/country context.
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'shipping_quotes') {
        return shippingQuotesTable;
      }
      // Anti-enumeration boundary: a body-only request must NEVER read the
      // merchants table. Currency is discovered through the definer RPC.
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn((name: string) => {
      if (name === 'get_storefront_shipping_sender') {
        const nonNgMerchant =
          typeof ratesPayload === 'object' &&
          ratesPayload !== null &&
          'merchant_country' in ratesPayload &&
          ratesPayload.merchant_country === 'IN';
        return Promise.resolve({
          data: {
            business_address: nonNgMerchant
              ? '1 Market Road, Bengaluru'
              : '1 Allen Avenue, Ikeja, Lagos',
            business_name: 'Merchant Store',
            country: nonNgMerchant ? 'IN' : 'NG',
            phone: nonNgMerchant ? '+919876543210' : '+2348012345678',
            state_code: nonNgMerchant ? null : 'LA',
          },
          error: null,
        });
      }
      if (name === 'get_storefront_shipping_rates') {
        return Promise.resolve({ data: ratesPayload, error: null });
      }
      throw new Error(`Unexpected RPC: ${name}`);
    }),
    shippingQuotesTable,
  };
}

async function postBodyOnlyQuotes(
  ratesPayload: unknown,
  overrides: Record<string, unknown> = {}
) {
  const supabase = buildBodyOnlySupabaseMock(ratesPayload);
  mockCreateAdminClient.mockReturnValue(supabase);
  mockCreateServerClient.mockResolvedValue(supabase);
  const { POST } = await import('./route');

  const request = buildDomesticRequest({
    merchantId: BODY_MERCHANT_ID,
    ...overrides,
  });
  request.headers.set('x-baci-client', 'mobile-storefront');
  const response = await POST(request);
  return { json: await response.json(), response, supabase };
}

describe('POST /api/shipping/quotes body-only merchant-currency discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQuotes.mockResolvedValue({
      quotes: { featured: [giglQuote], all: [giglQuote] },
      sessionId: 'session-1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
  });

  it('suppresses NGN carriers for a body-only non-supporting client once the RPC reveals a non-NG merchant', async () => {
    // supports_merchant_rates absent: the RPC still runs (currency discovery),
    // reveals an IN/INR merchant, so the Nigerian NGN carrier quotes are
    // dropped and the unbookable mrate_ quotes are withheld from the incapable
    // client — leaving the empty + unavailable-warning response.
    const { json, response } = await postBodyOnlyQuotes(
      indiaRatesPayloadWithCurrency,
      { receiver: indiaReceiver }
    );

    expect(response.status).toBe(200);
    expect(json.quotes).toEqual({ featured: [], all: [] });
    // No leaked Nigerian carrier quote.
    expect(
      json.quotes.all.some(
        (quote: { provider: string }) => quote.provider === 'GIGL'
      )
    ).toBe(false);
    // No unbookable merchant-rate quote for the incapable client.
    expect(
      json.quotes.all.some((quote: { id: string }) =>
        quote.id.startsWith('mrate_')
      )
    ).toBe(false);
    expect(
      json.warnings.some((warning: string) =>
        /Nigerian merchants only/i.test(warning)
      )
    ).toBe(true);
  });

  it('exposes merchant-only rates for a body-only supporting client on a non-NG merchant', async () => {
    // supports_merchant_rates true: currency discovery reveals IN/INR, carriers
    // are suppressed, and the opted-in caller receives the bookable mrate_
    // quote.
    const { json, response } = await postBodyOnlyQuotes(
      indiaRatesPayloadWithCurrency,
      { receiver: indiaReceiver, supports_merchant_rates: true }
    );

    expect(response.status).toBe(200);
    expect(json.quotes.all).toEqual([
      expect.objectContaining({
        currency: 'INR',
        id: `mrate_${RATE_ID}`,
        price: 200,
        provider: 'MERCHANT',
      }),
    ]);
    expect(
      json.quotes.all.some(
        (quote: { provider: string }) => quote.provider === 'GIGL'
      )
    ).toBe(false);
    expect(json.warnings).toBeUndefined();
  });

  it('keeps carrier quotes for a body-only non-supporting client on an NG merchant', async () => {
    // The RPC returns an NG payload with no currency columns, so nothing new is
    // revealed and the NG carrier merge path stays byte-identical: carriers are
    // returned and no mrate_ quotes leak.
    const { json, response } = await postBodyOnlyQuotes(lagosRatesPayload);

    expect(response.status).toBe(200);
    expect(mockGetQuotes).toHaveBeenCalled();
    expect(json.quotes.all).toEqual([
      expect.objectContaining({ id: GIGL_QUOTE_ID, provider: 'GIGL' }),
    ]);
    expect(
      json.quotes.all.some((quote: { id: string }) =>
        quote.id.startsWith('mrate_')
      )
    ).toBe(false);
    expect(json.warnings).toBeUndefined();
  });
});
