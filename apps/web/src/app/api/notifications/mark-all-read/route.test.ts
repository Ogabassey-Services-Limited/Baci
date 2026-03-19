import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

const mockHasPermission = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

const MERCHANT_ID = 'merchant-123';
const USER_ID = 'user-123';

let authUser: { id: string } | null = { id: USER_ID };
let merchantContext: {
  merchantId: string;
  staffAccess: {
    isStaff: boolean;
    isOwner: boolean;
    role: null;
    permissions: Record<string, unknown>;
  };
} | null = {
  merchantId: MERCHANT_ID,
  staffAccess: {
    isStaff: false,
    isOwner: true,
    role: null,
    permissions: { full_access: { all: true } },
  },
};
let updateError: unknown = null;
let mockUpdateNotifications = vi.fn();
let mockEqMerchant = vi.fn();

const mockGetMerchantForApiRequest = vi.fn();
const mockToUserAccess = vi.fn();
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: (...args: unknown[]) => mockToUserAccess(...args),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: authUser },
          error: authUser ? null : { message: 'Not authenticated' },
        })
      ),
    },
    from: vi.fn((table: string) => {
      if (table === 'merchant_notifications') {
        return {
          update: mockUpdateNotifications.mockReturnValue({
            eq: mockEqMerchant.mockReturnValue({
              is: vi.fn().mockReturnValue({
                is: vi.fn(() => Promise.resolve({ error: updateError })),
              }),
            }),
          }),
        };
      }
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
      };
    }),
  })),
}));

describe('PATCH /api/notifications/mark-all-read', () => {
  const createRequest = () =>
    new Request('http://localhost/api/notifications/mark-all-read', {
      method: 'PATCH',
    }) as unknown as NextRequest;

  beforeEach(() => {
    vi.clearAllMocks();
    authUser = { id: USER_ID };
    merchantContext = {
      merchantId: MERCHANT_ID,
      staffAccess: {
        isStaff: false,
        isOwner: true,
        role: null,
        permissions: { full_access: { all: true } },
      },
    };
    updateError = null;
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockHasPermission.mockReturnValue(true);
    mockGetMerchantForApiRequest.mockResolvedValue(merchantContext);
    mockUpdateNotifications = vi.fn();
    mockEqMerchant = vi.fn();
    mockToUserAccess.mockReturnValue({
      merchantId: MERCHANT_ID,
      isStaff: false,
      isOwner: true,
      role: 'owner',
      permissions: { full_access: { all: true } },
    });
  });

  it('returns 403 with fallback when csrf is invalid and no response is provided', async () => {
    const { PATCH } = await import('./route');
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: undefined,
    });

    const res = await PATCH(createRequest());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('Invalid or missing CSRF token');
  });

  it('returns custom csrf response when provided by middleware', async () => {
    const { PATCH } = await import('./route');
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: new Response(JSON.stringify({ error: 'CSRF blocked' }), {
        status: 419,
      }),
    });

    const res = await PATCH(createRequest());
    const json = await res.json();

    expect(res.status).toBe(419);
    expect(json.error).toBe('CSRF blocked');
  });

  it('returns 401 when unauthenticated', async () => {
    const { PATCH } = await import('./route');
    authUser = null;

    const res = await PATCH(createRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 404 when merchant is not found', async () => {
    const { PATCH } = await import('./route');
    merchantContext = null;
    mockGetMerchantForApiRequest.mockResolvedValue(merchantContext);

    const res = await PATCH(createRequest());
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Merchant not found');
  });

  it('returns 403 when permission is denied', async () => {
    const { PATCH } = await import('./route');
    mockHasPermission.mockReturnValue(false);

    const res = await PATCH(createRequest());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('Permission denied');
  });

  it('returns 500 when update fails', async () => {
    const { PATCH } = await import('./route');
    updateError = { message: 'DB error' };

    const res = await PATCH(createRequest());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to mark all notifications as read');
  });

  it('returns success payload when mark-all update succeeds', async () => {
    const { PATCH } = await import('./route');

    const res = await PATCH(createRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, unread_count: 0 });
    expect(mockUpdateNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ read_at: expect.any(String) })
    );
    expect(mockEqMerchant).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
  });
});
