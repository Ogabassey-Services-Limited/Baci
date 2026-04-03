import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mockAuthenticateApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockToUserAccess = vi.fn();
const mockNotifyAdminUserDevices = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: (...args: unknown[]) => mockToUserAccess(...args),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyAdminUserDevices: (...args: unknown[]) =>
    mockNotifyAdminUserDevices(...args),
}));

function createRequest(body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/push/test', {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/admin/push/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: { from: vi.fn() },
      error: null,
    });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        role: null,
        permissions: { full_access: { all: true } },
      },
    });
    mockToUserAccess.mockReturnValue({
      merchantId: 'merchant-1',
      role: 'owner',
      isOwner: true,
      isStaff: false,
      permissions: { full_access: { all: true } },
    });
    mockHasPermission.mockReturnValue(true);
    mockNotifyAdminUserDevices.mockResolvedValue({
      sent: 1,
      failed: 0,
      errors: [],
    });
  });

  it('returns 403 when CSRF validation fails', async () => {
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: undefined,
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(403);
  });

  it('returns 401 when the request is unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      supabase: null,
      error: 'Unauthorized',
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(401);
  });

  it('returns 403 when the user lacks permission', async () => {
    mockHasPermission.mockReturnValue(false);

    const response = await POST(createRequest());

    expect(response.status).toBe(403);
  });

  it('sends a push test to the authenticated admin user devices', async () => {
    const response = await POST(
      createRequest({ title: 'Admin Push Test', body: 'Check delivery' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      status: 'sent',
      sent: 1,
      failed: 0,
      errors: [],
    });
    expect(mockNotifyAdminUserDevices).toHaveBeenCalledWith(
      'user-1',
      'Admin Push Test',
      'Check delivery',
      expect.objectContaining({
        type: 'admin_broadcast',
        source: 'admin_push_test',
        merchant_id: 'merchant-1',
      }),
      'admin'
    );
  });

  it('returns skipped_no_tokens when no active admin device is registered', async () => {
    mockNotifyAdminUserDevices.mockResolvedValue({
      sent: 0,
      failed: 0,
      errors: [],
    });

    const response = await POST(createRequest());
    const data = await response.json();

    expect(data.status).toBe('skipped_no_tokens');
  });
});
