import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockCookies = vi.fn();
const mockCreateClient = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const mockBookShipment = vi.fn();

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mockCheckCsrfProtection,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
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
    bookShipment: mockBookShipment,
  },
}));

function buildBookingRequest(): NextRequest {
  return new Request('https://usebaci.com/api/shipping/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: '11111111-1111-4111-8111-111111111111',
      carrierId: 'GIGL',
      quoteId: '22222222-2222-4222-8222-222222222222',
      sender: {
        name: 'Merchant Store',
        phone: '+2348011111111',
        address: '1 Merchant Road',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        countryCode: 'NG',
      },
      receiver: {
        name: 'Jane Customer',
        phone: '+14165550123',
        address: '999 New Address',
        city: 'Vancouver',
        state: 'British Columbia',
        country: 'Canada',
        countryCode: 'CA',
      },
      items: [{ name: 'Phone', quantity: 1, weight: 1, value: 500000 }],
    }),
  }) as unknown as NextRequest;
}

function buildSupabaseMock({
  matchingDestination = false,
  selectedQuoteId = '22222222-2222-4222-8222-222222222222',
}: {
  matchingDestination?: boolean;
  selectedQuoteId?: string | null;
} = {}) {
  const quoteReceiver = matchingDestination
    ? {
        name: 'Old Recipient',
        phone: '',
        address: '999 New Address',
        city: 'Vancouver',
        state: 'British Columbia',
        country: 'Canada',
        countryCode: 'CA',
      }
    : {
        name: 'Old Recipient',
        phone: '',
        address: '123 Queen Street West',
        city: 'Toronto',
        state: 'Ontario',
        country: 'Canada',
        countryCode: 'CA',
      };
  const ordersSelectChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        merchant_id: 'merchant-1',
        selected_quote_id: selectedQuoteId,
        shipping_status: 'pending',
        shipping_address: {
          address: '999 New Address',
          city: 'Vancouver',
          state: 'British Columbia',
          country: 'Canada',
          countryCode: 'CA',
        },
        order_items: [{ name: 'Phone', quantity: 1, price: 500000 }],
      },
      error: null,
    }),
  };
  const mutationChain = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi
      .fn()
      .mockResolvedValue({ data: { id: 'shipment-1' }, error: null }),
  };
  const quotesSelectChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => {
      expect(quotesSelectChain.eq).toHaveBeenCalledWith(
        'merchant_id',
        'merchant-1'
      );
      return Promise.resolve({
        data: {
          id: '22222222-2222-4222-8222-222222222222',
          merchant_id: 'merchant-1',
          provider: 'GIGL',
          provider_rate_id: 'GIGL_INTL_1_2_3_1',
          provider_metadata: {},
          quote_request: {
            merchantId: 'merchant-1',
            sessionId: 'session-1',
            shipmentType: 'international',
            sender: {
              name: 'Quoted Merchant Store',
              phone: '+2348099999999',
              address: '7 Quoted Origin',
              city: 'Ikeja',
              state: 'Lagos',
              country: 'Nigeria',
              countryCode: 'NG',
            },
            receiver: quoteReceiver,
            items: [{ name: 'Phone', quantity: 1, weight: 1, value: 500000 }],
          },
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          price: 4500,
          currency: 'NGN',
          estimated_days: 2,
        },
        error: null,
      });
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
      if (table === 'orders') {
        return {
          select: vi.fn(() => ordersSelectChain),
          update: vi.fn(() => mutationChain),
        };
      }
      if (table === 'shipping_quotes') {
        return {
          select: vi.fn(() => quotesSelectChain),
          update: vi.fn(() => mutationChain),
        };
      }
      if (table === 'shipments') {
        return { insert: vi.fn(() => mutationChain) };
      }
      if (table === 'merchants') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                business_name: 'Registered Merchant Store',
                business_address: '9 Registered Road, Ikeja, Lagos',
                phone: '+2348012345678',
                registered_address: {
                  city: 'Ikeja',
                  state: 'Lagos',
                  street: '9 Registered Road',
                },
                state_code: 'LA',
              },
              error: null,
            }),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('POST /api/shipping/book GIGL international guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockCookies.mockResolvedValue({});
    mockCreateClient.mockReturnValue(buildSupabaseMock());
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      businessName: 'Merchant Store',
    });
    mockHasPermission.mockReturnValue(true);
  });

  it('rejects a saved international quote that no longer matches the order', async () => {
    const { POST } = await import('./route');

    const response = await POST(buildBookingRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error:
        'The saved international shipping quote no longer matches this order. Please get a new quote before shipping.',
      code: 'INTERNATIONAL_QUOTE_ORDER_MISMATCH',
    });
    expect(mockBookShipment).not.toHaveBeenCalled();
  });

  it('rejects quote IDs that are not selected on the merchant order', async () => {
    mockCreateClient.mockReturnValue(
      buildSupabaseMock({
        selectedQuoteId: '33333333-3333-4333-8333-333333333333',
      })
    );
    const { POST } = await import('./route');

    const response = await POST(buildBookingRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Quote does not match order',
    });
    expect(mockBookShipment).not.toHaveBeenCalled();
  });

  it('books GIGL international shipments with the saved quote sender', async () => {
    mockCreateClient.mockReturnValue(
      buildSupabaseMock({ matchingDestination: true })
    );
    mockBookShipment.mockResolvedValue({
      provider: 'GIGL',
      providerShipmentId: 'provider-1',
      trackingNumber: 'GIGL-TRACK-1',
      carrierName: 'GIG Logistics',
      status: 'processing',
    });
    const { POST } = await import('./route');

    const response = await POST(buildBookingRequest());

    expect(response.status).toBe(201);
    expect(mockBookShipment).toHaveBeenCalledWith(
      'GIGL',
      expect.objectContaining({
        receiver: expect.objectContaining({
          name: 'Jane Customer',
          phone: '+14165550123',
          country: 'Canada',
          countryCode: 'CA',
        }),
        sender: expect.objectContaining({
          name: 'Quoted Merchant Store',
          address: '7 Quoted Origin',
          phone: '+2348099999999',
        }),
      })
    );
  });

  it('allows direct booking to bind a valid quote when the order has no saved quote', async () => {
    mockCreateClient.mockReturnValue(
      buildSupabaseMock({ matchingDestination: true, selectedQuoteId: null })
    );
    mockBookShipment.mockResolvedValue({
      provider: 'GIGL',
      providerShipmentId: 'provider-1',
      trackingNumber: 'GIGL-TRACK-1',
      carrierName: 'GIG Logistics',
      status: 'processing',
    });
    const { POST } = await import('./route');

    const response = await POST(buildBookingRequest());

    expect(response.status).toBe(201);
    expect(mockBookShipment).toHaveBeenCalledOnce();
  });
});
