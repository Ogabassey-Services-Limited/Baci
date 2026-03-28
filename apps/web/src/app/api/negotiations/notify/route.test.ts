import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

// =============================================================================
// Mocks
// =============================================================================

const mockNotifyNegotiationResponse = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/expo-push', () => ({
  notifyNegotiationResponse: (...args: unknown[]) =>
    mockNotifyNegotiationResponse(...args),
}));

const mockUser = { id: 'user-123' } as never;
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
}));

// =============================================================================
// Helpers
// =============================================================================

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/negotiations/notify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer valid-token',
    },
  });
}

const validBody = {
  negotiationId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  status: 'accepted' as const,
};

async function setupAuth(options: {
  authenticated?: boolean;
  hasAccess?: boolean;
  merchantId?: string;
}) {
  const { authenticateApiRequest, getUserAccess, hasPermission } = await import(
    '@/lib/api-auth'
  );

  if (options.authenticated === false) {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'No session',
      supabase: null,
    });
  } else {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: mockUser,
      error: null,
      supabase: mockSupabase as never,
    });
  }

  if (options.hasAccess === false) {
    vi.mocked(getUserAccess).mockResolvedValue(null);
    vi.mocked(hasPermission).mockReturnValue(false);
  } else {
    vi.mocked(getUserAccess).mockResolvedValue({
      merchantId: options.merchantId ?? 'merchant-123',
      role: 'owner',
      permissions: {},
    } as never);
    vi.mocked(hasPermission).mockReturnValue(true);
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('POST /api/negotiations/notify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    await setupAuth({ authenticated: false });

    const request = createRequest(validBody);
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('returns 403 when user lacks permission', async () => {
    await setupAuth({ authenticated: true, hasAccess: false });

    const request = createRequest(validBody);
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it('returns 400 for invalid body', async () => {
    await setupAuth({ authenticated: true, hasAccess: true });

    const request = createRequest({ negotiationId: 'not-uuid' });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 404 when negotiation not found', async () => {
    await setupAuth({ authenticated: true, hasAccess: true });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }),
      }),
    });

    const request = createRequest(validBody);
    const response = await POST(request);

    expect(response.status).toBe(404);
  });

  it('returns 403 when merchant does not own negotiation', async () => {
    await setupAuth({
      authenticated: true,
      hasAccess: true,
      merchantId: 'merchant-123',
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: validBody.negotiationId,
              merchant_id: 'different-merchant',
              customer_id: 'customer-456',
              type: 'single',
              item_info: { name: 'Product' },
              offered_price: 5000,
              status: 'pending',
            },
            error: null,
          }),
        }),
      }),
    });

    const request = createRequest(validBody);
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it('returns notified: false for guest negotiations (no customer_id)', async () => {
    await setupAuth({
      authenticated: true,
      hasAccess: true,
      merchantId: 'merchant-123',
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: validBody.negotiationId,
              merchant_id: 'merchant-123',
              customer_id: null,
              type: 'single',
              item_info: { name: 'Product' },
              offered_price: 5000,
              status: 'pending',
            },
            error: null,
          }),
        }),
      }),
    });

    const request = createRequest(validBody);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ notified: false, reason: 'no_customer_id' });
    expect(mockNotifyNegotiationResponse).not.toHaveBeenCalled();
  });

  it('sends push notification for authenticated customer negotiation', async () => {
    await setupAuth({
      authenticated: true,
      hasAccess: true,
      merchantId: 'merchant-123',
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: validBody.negotiationId,
              merchant_id: 'merchant-123',
              customer_id: 'customer-456',
              type: 'single',
              item_info: { name: 'Cool Sneakers' },
              offered_price: 5000,
              status: 'pending',
            },
            error: null,
          }),
        }),
      }),
    });

    const request = createRequest(validBody);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ notified: true });
    expect(mockNotifyNegotiationResponse).toHaveBeenCalledWith(
      'customer-456',
      'single',
      'accepted',
      'Cool Sneakers',
      5000
    );
  });

  it('passes null acceptedPrice for rejected negotiations', async () => {
    await setupAuth({
      authenticated: true,
      hasAccess: true,
      merchantId: 'merchant-123',
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: validBody.negotiationId,
              merchant_id: 'merchant-123',
              customer_id: 'customer-456',
              type: 'total',
              item_info: null,
              offered_price: 8000,
              status: 'pending',
            },
            error: null,
          }),
        }),
      }),
    });

    const request = createRequest({
      negotiationId: validBody.negotiationId,
      status: 'rejected',
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockNotifyNegotiationResponse).toHaveBeenCalledWith(
      'customer-456',
      'total',
      'rejected',
      null,
      null
    );
  });
});
