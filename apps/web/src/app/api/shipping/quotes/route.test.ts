import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateAdminClient = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const mockGetQuotes = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mockCreateAdminClient,
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
      items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
      ...overrides,
    }),
  }) as unknown as NextRequest;
}

function buildSupabaseMock(
  user: { id: string } | null = null,
  merchantError: unknown = null
) {
  const merchantSelect = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        business_name: 'Merchant Store',
        business_address: '1 Merchant Road, Lagos',
        phone: '08012345678',
      },
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
        return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      }
      throw new Error(`Unexpected table: ${table}`);
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
  });

  it('allows merchant sender fallback before international quote creation', async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabaseMock({ id: 'user-1' }));
    const { POST } = await import('./route');

    const response = await POST(buildQuoteRequest());

    expect(response.status).toBe(200);
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

  it('uses merchant sender details for public international quotes', async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabaseMock(null));
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

    expect(response.status).toBe(200);
    expect(mockGetQuotes).toHaveBeenCalledWith(
      expect.objectContaining({
        sender: expect.objectContaining({
          name: 'Merchant Store',
          address: '1 Merchant Road, Lagos',
          phone: '08012345678',
          country: 'Nigeria',
          countryCode: 'NG',
        }),
      })
    );
  });

  it('returns 500 when merchant sender lookup fails', async () => {
    mockCreateAdminClient.mockReturnValue(
      buildSupabaseMock(null, { message: 'database unavailable' })
    );
    const { POST } = await import('./route');

    const response = await POST(
      buildQuoteRequest({
        merchantId: '11111111-1111-4111-8111-111111111111',
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to resolve merchant sender',
    });
    expect(mockGetQuotes).not.toHaveBeenCalled();
  });
});
