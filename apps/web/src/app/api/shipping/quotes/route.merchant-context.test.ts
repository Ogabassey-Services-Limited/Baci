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
    const adminClient = { from: vi.fn() };
    mockCreateAdminClient.mockReturnValue(adminClient);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-without-merchant-context' } },
          error: null,
        }),
      },
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

    expect(response.status).toBe(200);
    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      adminClient,
      'user-without-merchant-context',
      { requestedMerchantId: '11111111-1111-4111-8111-111111111111' }
    );
    expect(adminClient.from).not.toHaveBeenCalledWith('merchants');
    expect(mockGetQuotes).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: '11111111-1111-4111-8111-111111111111',
        sender: expect.objectContaining({
          address: 'Lagos',
          name: 'Merchant',
        }),
      })
    );
  });
});
