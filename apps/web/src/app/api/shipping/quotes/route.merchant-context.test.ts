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

describe('POST /api/shipping/quotes merchant context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMerchantForApiRequest.mockResolvedValue(null);
    mockGetQuotes.mockResolvedValue({
      quotes: { featured: [], all: [] },
      sessionId: 'session-1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
  });

  it('does not load sender details from an arbitrary merchant ID', async () => {
    const adminClient = {
      from: vi.fn(),
      // Merchant-rates RPC resolves empty so this request stays carrier-only.
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockCreateAdminClient.mockReturnValue(adminClient);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-without-merchant-context' } },
          error: null,
        }),
      },
      rpc: adminClient.rpc,
    });
    const { POST } = await import('./route');

    const response = await POST(
      new Request('https://usebaci.com/api/shipping/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentType: 'domestic',
          merchantId: '11111111-1111-4111-8111-111111111111',
          receiver: {
            name: 'Jane Receiver',
            address: '123 Test Road',
            city: 'Abuja',
            state: 'FCT',
          },
          items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
        }),
      }) as unknown as NextRequest
    );

    expect(response.status).toBe(400);
    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      adminClient,
      'user-without-merchant-context',
      { requestedMerchantId: '11111111-1111-4111-8111-111111111111' }
    );
    expect(adminClient.from).not.toHaveBeenCalledWith('merchants');
    expect(mockGetQuotes).not.toHaveBeenCalled();
  });

  it('quotes a non-NG merchant on the body-only path without reading the merchants table', async () => {
    // Root-domain slug storefront: only a body merchantId, no trusted
    // x-merchant-slug header and no auth. The route cannot read `merchants` for
    // the arbitrary body id (anti-enumeration), so the merchant's INR currency
    // must come from the definer RPC — and its INR rates must survive the
    // stale-currency filter that would otherwise default to NGN.
    const MERCHANT_ID = '22222222-2222-4222-8222-222222222222';
    const ZONE_ID = '44444444-4444-4444-8444-444444444444';
    const RATE_ID = '55555555-5555-4555-8555-555555555555';

    const adminClient = {
      from: vi.fn(),
      rpc: vi.fn().mockImplementation((name: string) => ({
        data: {
          ...(name === 'get_storefront_shipping_sender'
            ? {
                business_address: '12 MG Road, Mumbai, Maharashtra',
                business_name: 'India Store',
                country: 'IN',
                phone: '+919876543210',
                state_code: 'MH',
              }
            : {}),
          ...(name !== 'get_storefront_shipping_sender'
            ? {
                zones: [
                  {
                    id: ZONE_ID,
                    name: 'India',
                    is_rest_of_world: false,
                    active: true,
                  },
                ],
                locations: [
                  {
                    zone_id: ZONE_ID,
                    country_code: 'IN',
                    subdivision_code: null,
                  },
                ],
                rates: [
                  {
                    id: RATE_ID,
                    zone_id: ZONE_ID,
                    name: 'Standard',
                    kind: 'ship',
                    currency: 'INR',
                    base_amount: 200,
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
                merchant_payout_currency: 'INR',
                merchant_country: 'IN',
              }
            : {}),
        },
        error: null,
      })),
    };
    mockCreateAdminClient.mockReturnValue(adminClient);
    // Anonymous body-only request: no session user.
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
      },
      rpc: adminClient.rpc,
    });
    const { POST } = await import('./route');

    const response = await POST(
      new Request('https://usebaci.com/api/shipping/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-baci-client': 'mobile-storefront',
        },
        body: JSON.stringify({
          shipmentType: 'domestic',
          merchantId: MERCHANT_ID,
          supports_merchant_rates: true,
          receiver: {
            name: 'Jane Receiver',
            address: '12 MG Road',
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            countryCode: 'IN',
          },
          items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
        }),
      }) as unknown as NextRequest
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    // The merchant's INR rate survives (previously dropped by the NGN default).
    expect(json.quotes.all).toContainEqual(
      expect.objectContaining({
        currency: 'INR',
        id: `mrate_${RATE_ID}`,
        price: 200,
        provider: 'MERCHANT',
      })
    );
    // Anti-enumeration boundary intact: no merchants read for the body id.
    expect(adminClient.from).not.toHaveBeenCalledWith('merchants');
    expect(adminClient.rpc).toHaveBeenCalledWith(
      'get_storefront_shipping_rates',
      { p_merchant_id: MERCHANT_ID }
    );
  });

  it('suppresses NGN carrier quotes for a body-only non-NG merchant with rates', async () => {
    // Same body-only path, but carriers DO return a Lagos NGN quote. The route
    // defaulted to NGN (no trusted header) and did not early-skip carriers, so
    // the RPC-revealed IN country must drop those carrier quotes at merge time —
    // otherwise a selected Lagos NGN fee would be mis-charged as INR by
    // /api/orders. The response must be merchant-rate-only.
    const MERCHANT_ID = '22222222-2222-4222-8222-222222222222';
    const ZONE_ID = '44444444-4444-4444-8444-444444444444';
    const RATE_ID = '55555555-5555-4555-8555-555555555555';
    const GIGL_QUOTE_ID = '33333333-3333-4333-8333-333333333333';

    const adminClient = {
      from: vi.fn(),
      rpc: vi.fn().mockImplementation((name: string) => ({
        data: {
          ...(name === 'get_storefront_shipping_sender'
            ? {
                business_address: '12 MG Road, Mumbai, Maharashtra',
                business_name: 'India Store',
                country: 'IN',
                phone: '+919876543210',
                state_code: 'MH',
              }
            : {}),
          ...(name !== 'get_storefront_shipping_sender'
            ? {
                zones: [
                  {
                    id: ZONE_ID,
                    name: 'India',
                    is_rest_of_world: false,
                    active: true,
                  },
                ],
                locations: [
                  {
                    zone_id: ZONE_ID,
                    country_code: 'IN',
                    subdivision_code: null,
                  },
                ],
                rates: [
                  {
                    id: RATE_ID,
                    zone_id: ZONE_ID,
                    name: 'Standard',
                    kind: 'ship',
                    currency: 'INR',
                    base_amount: 200,
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
                merchant_payout_currency: 'INR',
                merchant_country: 'IN',
              }
            : {}),
        },
        error: null,
      })),
    };
    mockCreateAdminClient.mockReturnValue(adminClient);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
      },
      rpc: adminClient.rpc,
    });
    // Carriers return a Lagos NGN quote that must be dropped.
    mockGetQuotes.mockResolvedValue({
      quotes: {
        featured: [],
        all: [
          {
            id: GIGL_QUOTE_ID,
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
      new Request('https://usebaci.com/api/shipping/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-baci-client': 'mobile-storefront',
        },
        body: JSON.stringify({
          shipmentType: 'domestic',
          merchantId: MERCHANT_ID,
          supports_merchant_rates: true,
          receiver: {
            name: 'Jane Receiver',
            address: '12 MG Road',
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            countryCode: 'IN',
          },
          items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
        }),
      }) as unknown as NextRequest
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    // Only the INR merchant rate survives; the Lagos NGN carrier quote is gone.
    expect(json.quotes.all).toEqual([
      expect.objectContaining({
        currency: 'INR',
        id: `mrate_${RATE_ID}`,
        provider: 'MERCHANT',
      }),
    ]);
    expect(
      json.quotes.all.some(
        (quote: { provider: string }) => quote.provider === 'GIGL'
      )
    ).toBe(false);
    expect(
      json.quotes.featured.some(
        (quote: { provider: string }) => quote.provider === 'GIGL'
      )
    ).toBe(false);
    // The projected non-NG origin prevents Nigeria-only carrier calls.
    expect(mockGetQuotes).not.toHaveBeenCalled();
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it('suppresses carriers and warns for a body-only non-NG merchant with no rates', async () => {
    // Body-only non-NG merchant with NO configured rates. Carriers (Lagos NGN)
    // are still fetched but must be suppressed via the RPC-revealed country, so
    // the response is empty + the Nigerian-merchants-only warning, matching the
    // header-resolved non-NG path.
    const MERCHANT_ID = '22222222-2222-4222-8222-222222222222';

    const adminClient = {
      from: vi.fn(),
      rpc: vi.fn().mockImplementation((name: string) => ({
        data: {
          ...(name === 'get_storefront_shipping_sender'
            ? {
                business_address: '12 MG Road, Mumbai, Maharashtra',
                business_name: 'India Store',
                country: 'IN',
                phone: '+919876543210',
                state_code: 'MH',
              }
            : {}),
          ...(name !== 'get_storefront_shipping_sender'
            ? {
                zones: [],
                locations: [],
                rates: [],
                merchant_payout_currency: 'INR',
                merchant_country: 'IN',
              }
            : {}),
        },
        error: null,
      })),
    };
    mockCreateAdminClient.mockReturnValue(adminClient);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
      },
      rpc: adminClient.rpc,
    });
    mockGetQuotes.mockResolvedValue({
      quotes: {
        featured: [],
        all: [
          {
            id: '33333333-3333-4333-8333-333333333333',
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
      new Request('https://usebaci.com/api/shipping/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-baci-client': 'mobile-storefront',
        },
        body: JSON.stringify({
          shipmentType: 'domestic',
          merchantId: MERCHANT_ID,
          supports_merchant_rates: true,
          receiver: {
            name: 'Jane Receiver',
            address: '12 MG Road',
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            countryCode: 'IN',
          },
          items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
        }),
      }) as unknown as NextRequest
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.quotes).toEqual({ featured: [], all: [] });
    expect(
      json.warnings.some((warning: string) =>
        /Nigerian merchants only/i.test(warning)
      )
    ).toBe(true);
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it('fails closed and suppresses NGN carriers when the rate RPC errors on the body-only path', async () => {
    // Body-only path (no trusted header/auth), so the route defaulted the
    // merchant currency to NGN and did NOT early-skip carriers. The rate RPC now
    // ERRORS, so getMerchantRateQuotes can resolve neither currency nor country —
    // the route cannot tell whether this merchant is non-NG. It must FAIL CLOSED:
    // suppress the already-fetched Lagos NGN carrier quotes (which /api/orders
    // could otherwise charge in the merchant's unknown currency) and return the
    // merchant-only (empty + unavailable-warning) response.
    const MERCHANT_ID = '22222222-2222-4222-8222-222222222222';

    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const adminClient = {
      from: vi.fn(),
      // RPC failure: no data, no resolved currency/country.
      rpc: vi.fn().mockImplementation((name: string) =>
        name === 'get_storefront_shipping_sender'
          ? {
              data: {
                business_address: '12 MG Road, Mumbai, Maharashtra',
                business_name: 'India Store',
                country: 'IN',
                phone: '+919876543210',
                state_code: 'MH',
              },
              error: null,
            }
          : {
              data: null,
              error: { message: 'permission denied', code: '42501' },
            }
      ),
    };
    mockCreateAdminClient.mockReturnValue(adminClient);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
      },
      rpc: adminClient.rpc,
    });
    // Carriers return a Lagos NGN quote that must NOT survive the fail-closed.
    mockGetQuotes.mockResolvedValue({
      quotes: {
        featured: [],
        all: [
          {
            id: '33333333-3333-4333-8333-333333333333',
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
      new Request('https://usebaci.com/api/shipping/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-baci-client': 'mobile-storefront',
        },
        body: JSON.stringify({
          shipmentType: 'domestic',
          merchantId: MERCHANT_ID,
          supports_merchant_rates: true,
          receiver: {
            name: 'Jane Receiver',
            address: '12 MG Road',
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            countryCode: 'IN',
          },
          items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
        }),
      }) as unknown as NextRequest
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    // No carrier quote survives the fail-closed suppression.
    expect(json.quotes.all).toEqual([]);
    expect(
      json.quotes.all.some(
        (quote: { provider: string }) => quote.provider === 'GIGL'
      )
    ).toBe(false);
    // Empty merchant-only response carries the Nigerian-merchants-only warning.
    expect(
      json.warnings.some((warning: string) =>
        /Nigerian merchants only/i.test(warning)
      )
    ).toBe(true);
    // The projected non-NG origin prevents Nigeria-only carrier calls.
    expect(mockGetQuotes).not.toHaveBeenCalled();
    expect(adminClient.from).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });
});
