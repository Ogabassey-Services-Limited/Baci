import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateAdminClient = vi.fn();
const mockCreateServerClient = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
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
  hasPermission: mockHasPermission,
}));

vi.mock('@/lib/shipping', () => ({
  shippingService: {
    getQuotes: mockGetQuotes,
  },
}));

const quoteItems = [
  { hsCode: '851712', name: 'Phone', quantity: 1, value: 100_000, weight: 1 },
];

function buildQuoteRequest(
  overrides: Record<string, unknown> = {}
): NextRequest {
  return new Request('https://usebaci.com/api/shipping/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shipmentType: 'international',
      receiver: {
        name: 'Jane Receiver',
        address: '123 Queen Street West',
        city: 'Toronto',
        state: 'Ontario',
        country: 'Canada',
        countryCode: 'CA',
      },
      items: quoteItems,
      ...overrides,
    }),
  }) as unknown as NextRequest;
}

function buildSupabaseMock(
  user: { id: string } | null = null,
  merchantError: unknown = null,
  merchantDetails: unknown = {
    business_name: 'Merchant Store',
    business_address: '1 Merchant Road, Lagos',
    phone: '08012345678',
  }
) {
  const shippingQuotesTable = {
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
  const merchantSelect = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: merchantDetails,
      error:
        merchantError ??
        (merchantDetails ? null : { code: 'PGRST116', message: 'No rows' }),
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: merchantDetails,
      error: merchantError,
    }),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
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
    // Merchant-configured rates RPC: no rates by default, so the historical
    // carrier-only expectations in this suite stay byte-identical.
    rpc: vi.fn().mockResolvedValue({
      data: { locations: [], rates: [], zones: [] },
      error: null,
    }),
  };
}

describe('POST /api/shipping/quotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockReturnValue(true);
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      businessName: 'Merchant Store',
    });
    mockGetQuotes.mockResolvedValue({
      quotes: { featured: [], all: [] },
      sessionId: 'session-1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    mockCreateServerClient.mockResolvedValue(buildSupabaseMock(null));
  });

  it('rejects public international quotes without a merchant sender', async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabaseMock(null));
    const { POST } = await import('./route');

    const response = await POST(
      buildQuoteRequest({
        sender: {
          name: 'Caller Supplied Origin',
          phone: '08099999999',
          address: 'Cheap Origin',
          city: 'Aba',
          state: 'Abia',
          country: 'Nigeria',
          countryCode: 'NG',
        },
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Sender is required for international quotes',
    });
    expect(mockGetQuotes).not.toHaveBeenCalled();
  }, 30_000);

  it('allows merchant sender fallback before international quote creation', async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabaseMock({ id: 'user-1' }));
    mockCreateServerClient.mockResolvedValue(
      buildSupabaseMock({ id: 'user-1' })
    );
    const { POST } = await import('./route');

    const response = await POST(buildQuoteRequest());

    expect(response.status).toBe(200);
    expect(mockCreateServerClient).toHaveBeenCalled();
    expect(mockGetQuotes).toHaveBeenCalledWith(
      expect.objectContaining({
        sender: expect.objectContaining({
          name: 'Merchant Store',
          country: 'Nigeria',
          countryCode: 'NG',
        }),
      })
    );
  });

  it('rejects public international quotes with an arbitrary merchant ID', async () => {
    const supabase = buildSupabaseMock(null);
    mockCreateAdminClient.mockReturnValue(supabase);
    const { POST } = await import('./route');

    const response = await POST(
      buildQuoteRequest({
        merchantId: '11111111-1111-4111-8111-111111111111',
        sender: {
          name: 'Caller Supplied Origin',
          phone: '08099999999',
          address: 'Cheap Origin',
          city: 'Aba',
          state: 'Abia',
          country: 'Nigeria',
          countryCode: 'NG',
        },
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Sender is required for international quotes',
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(mockGetQuotes).not.toHaveBeenCalled();
  });

  it('rejects international quote merchant IDs when auth has no merchant context', async () => {
    const supabase = buildSupabaseMock({ id: 'user-1' });
    mockCreateAdminClient.mockReturnValue(supabase);
    mockCreateServerClient.mockResolvedValue(
      buildSupabaseMock({ id: 'user-1' })
    );
    mockGetMerchantForApiRequest.mockResolvedValue(null);
    const { POST } = await import('./route');

    const response = await POST(
      buildQuoteRequest({
        merchantId: '11111111-1111-4111-8111-111111111111',
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Sender is required for international quotes',
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(mockGetQuotes).not.toHaveBeenCalled();
  });

  it('stores the resolved authenticated merchant on international quote requests', async () => {
    const supabase = buildSupabaseMock({ id: 'user-1' });
    mockCreateAdminClient.mockReturnValue(supabase);
    mockCreateServerClient.mockResolvedValue(
      buildSupabaseMock({ id: 'user-1' })
    );
    mockGetQuotes.mockResolvedValue({
      quotes: {
        featured: [],
        all: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            provider: 'GIGL',
            serviceTier: 'Standard',
            carrierName: 'GIG Logistics',
            displayName: 'GIG Logistics International',
            estimatedDays: 5,
            price: 25_000,
            currency: 'NGN',
            pickupIncluded: true,
            insuranceIncluded: true,
            providerRateId: 'GIGL_INTL_1_2_3_1',
            expiresAt: new Date(Date.now() + 60_000),
          },
        ],
      },
      sessionId: 'session-1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const { POST } = await import('./route');

    const response = await POST(buildQuoteRequest());

    expect(response.status).toBe(200);
    const quotesTable = supabase.from('shipping_quotes') as {
      upsert: ReturnType<typeof vi.fn>;
    };
    expect(quotesTable.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-1',
        quote_request: expect.objectContaining({
          merchantId: 'merchant-1',
        }),
      }),
      { onConflict: 'id' }
    );
  });

  it('returns 500 when merchant sender lookup fails', async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabaseMock({ id: 'user-1' }));
    mockCreateServerClient.mockResolvedValue(
      buildSupabaseMock({ id: 'user-1' }, { message: 'database unavailable' })
    );
    const { POST } = await import('./route');

    const response = await POST(buildQuoteRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to resolve merchant sender',
    });
    expect(mockGetQuotes).not.toHaveBeenCalled();
  });

  it('does not treat a missing authenticated merchant row as a query failure', async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabaseMock({ id: 'user-1' }));
    mockCreateServerClient.mockResolvedValue(
      buildSupabaseMock({ id: 'user-1' }, null, null)
    );
    const { POST } = await import('./route');

    const response = await POST(buildQuoteRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Sender is required for international quotes',
    });
    expect(mockGetQuotes).not.toHaveBeenCalled();
  });

  it('returns empty quotes with a Nigerian-merchants-only warning for a non-NG merchant', async () => {
    const merchantDetails = {
      business_name: 'Merchant Store',
      business_address: '1 Merchant Road, Bengaluru',
      country: 'IN',
      phone: '+919876543210',
    };
    mockCreateAdminClient.mockReturnValue(
      buildSupabaseMock({ id: 'user-1' }, null, merchantDetails)
    );
    mockCreateServerClient.mockResolvedValue(
      buildSupabaseMock({ id: 'user-1' }, null, merchantDetails)
    );
    const { POST } = await import('./route');

    const response = await POST(buildQuoteRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.quotes).toEqual({ featured: [], all: [] });
    expect(
      json.warnings.some((warning: string) =>
        /Nigerian merchants/i.test(warning)
      )
    ).toBe(true);
    expect(mockGetQuotes).not.toHaveBeenCalled();
  });

  it('still fetches quotes when the merchant country is Nigeria', async () => {
    const merchantDetails = {
      business_name: 'Merchant Store',
      business_address: '1 Merchant Road, Lagos',
      country: 'NG',
      phone: '08012345678',
    };
    mockCreateAdminClient.mockReturnValue(
      buildSupabaseMock({ id: 'user-1' }, null, merchantDetails)
    );
    mockCreateServerClient.mockResolvedValue(
      buildSupabaseMock({ id: 'user-1' }, null, merchantDetails)
    );
    const { POST } = await import('./route');

    const response = await POST(buildQuoteRequest());

    expect(response.status).toBe(200);
    expect(mockGetQuotes).toHaveBeenCalled();
  });

  it('still fetches quotes when the merchant country is null', async () => {
    const merchantDetails = {
      business_name: 'Merchant Store',
      business_address: '1 Merchant Road, Lagos',
      country: null,
      phone: '08012345678',
    };
    mockCreateAdminClient.mockReturnValue(
      buildSupabaseMock({ id: 'user-1' }, null, merchantDetails)
    );
    mockCreateServerClient.mockResolvedValue(
      buildSupabaseMock({ id: 'user-1' }, null, merchantDetails)
    );
    const { POST } = await import('./route');

    const response = await POST(buildQuoteRequest());

    expect(response.status).toBe(200);
    expect(mockGetQuotes).toHaveBeenCalled();
  });

  it('returns empty quotes when the merchant payout currency is not NGN even for an NG merchant', async () => {
    const merchantDetails = {
      business_name: 'Merchant Store',
      business_address: '1 Merchant Road, Lagos',
      country: 'NG',
      payout_currency: 'GHS',
      phone: '08012345678',
    };
    mockCreateAdminClient.mockReturnValue(
      buildSupabaseMock({ id: 'user-1' }, null, merchantDetails)
    );
    mockCreateServerClient.mockResolvedValue(
      buildSupabaseMock({ id: 'user-1' }, null, merchantDetails)
    );
    const { POST } = await import('./route');

    const response = await POST(buildQuoteRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.quotes).toEqual({ featured: [], all: [] });
    expect(
      json.warnings.some((warning: string) =>
        /Nigerian merchants/i.test(warning)
      )
    ).toBe(true);
    expect(mockGetQuotes).not.toHaveBeenCalled();
  });

  it('returns empty quotes for a non-NGN payout merchant with no country set', async () => {
    const merchantDetails = {
      business_name: 'Merchant Store',
      business_address: '1 Merchant Road, Accra',
      country: null,
      payout_currency: 'GHS',
      phone: '+233201234567',
    };
    mockCreateAdminClient.mockReturnValue(
      buildSupabaseMock({ id: 'user-1' }, null, merchantDetails)
    );
    mockCreateServerClient.mockResolvedValue(
      buildSupabaseMock({ id: 'user-1' }, null, merchantDetails)
    );
    const { POST } = await import('./route');

    const response = await POST(buildQuoteRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.quotes).toEqual({ featured: [], all: [] });
    expect(mockGetQuotes).not.toHaveBeenCalled();
  });

  it('ranks a cheaper merchant rate ahead of a pricier carrier in the merged list', async () => {
    const zoneId = '44444444-4444-4444-8444-444444444444';
    const rateId = '55555555-5555-4555-8555-555555555555';
    const supabase = buildSupabaseMock({ id: 'user-1' }, null, {
      business_name: 'Merchant Store',
      business_address: '1 Merchant Road, Lagos',
      country: 'NG',
      payout_currency: 'NGN',
      phone: '08012345678',
    });
    // Merchant configured one cheap Lagos rate; the carrier quote is pricier.
    supabase.rpc = vi.fn().mockResolvedValue({
      data: {
        zones: [
          { id: zoneId, name: 'Lagos', is_rest_of_world: false, active: true },
        ],
        locations: [
          { zone_id: zoneId, country_code: 'NG', subdivision_code: 'NG-LA' },
        ],
        rates: [
          {
            id: rateId,
            zone_id: zoneId,
            name: 'Lagos Standard',
            kind: 'ship',
            currency: 'NGN',
            base_amount: 1000,
            condition_type: 'always',
            min_subtotal: null,
            max_subtotal: null,
            free_over_amount: null,
            delivery_min_days: 1,
            delivery_max_days: 3,
            pickup_address: null,
            sort_order: 0,
            active: true,
          },
        ],
      },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(supabase);
    mockCreateServerClient.mockResolvedValue(
      buildSupabaseMock({ id: 'user-1' })
    );
    mockGetQuotes.mockResolvedValue({
      quotes: {
        featured: [],
        all: [
          {
            id: 'gigl-quote-1',
            provider: 'GIGL',
            serviceTier: 'Standard',
            carrierName: 'GIG Logistics',
            displayName: 'GIG Logistics',
            estimatedDays: 3,
            price: 5000,
            currency: 'NGN',
            pickupIncluded: true,
            insuranceIncluded: true,
            expiresAt: new Date(Date.now() + 60_000),
          },
        ],
      },
      sessionId: 'session-1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const { POST } = await import('./route');

    const response = await POST(
      buildQuoteRequest({
        shipmentType: 'domestic',
        supports_merchant_rates: true,
        receiver: {
          name: 'Ada Buyer',
          phone: '08011112222',
          address: '5 Balogun Street',
          city: 'Ikeja',
          state: 'Lagos',
          country: 'Nigeria',
          countryCode: 'NG',
        },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    const all = json.quotes.all as Array<{ id: string; price: number }>;
    expect(all[0]).toMatchObject({ id: `mrate_${rateId}`, price: 1000 });
    const merchantIndex = all.findIndex((q) => q.id === `mrate_${rateId}`);
    const carrierIndex = all.findIndex((q) => q.id === 'gigl-quote-1');
    expect(merchantIndex).toBeGreaterThanOrEqual(0);
    expect(carrierIndex).toBeGreaterThanOrEqual(0);
    expect(merchantIndex).toBeLessThan(carrierIndex);
  });

  it('still fetches quotes when the payout currency is NGN and the country is NG', async () => {
    mockCreateAdminClient.mockReturnValue(
      buildSupabaseMock({ id: 'user-1' }, null, {
        business_name: 'Merchant Store',
        business_address: '1 Merchant Road, Lagos',
        country: 'NG',
        payout_currency: 'NGN',
        phone: '08012345678',
      })
    );
    mockCreateServerClient.mockResolvedValue(
      buildSupabaseMock({ id: 'user-1' })
    );
    const { POST } = await import('./route');

    const response = await POST(buildQuoteRequest());

    expect(response.status).toBe(200);
    expect(mockGetQuotes).toHaveBeenCalled();
  });
});
