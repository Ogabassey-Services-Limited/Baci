import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockAuthenticateApiRequest = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockCreateVirtualTerminal = vi.fn();
const mockAdminFrom = vi.fn();
const mockAdminInsert = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({})),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: vi.fn(() => ({
    isOwner: true,
    isStaff: false,
    merchantId: 'merchant-1',
    permissions: { integrations: { manage: true } },
    role: 'owner',
  })),
}));

vi.mock('@/lib/paystack', () => ({
  createVirtualTerminal: (...args: unknown[]) =>
    mockCreateVirtualTerminal(...args),
}));

import { POST } from './route';

function createRequest() {
  return new NextRequest('http://localhost/api/paystack/virtual-terminal', {
    body: JSON.stringify({
      merchantId: '22222222-2222-4222-8222-222222222222',
      name: 'Sales Terminal',
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

describe('POST /api/paystack/virtual-terminal legacy sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { from: mockFrom, rpc: mockRpc },
      user: { id: 'user-1' },
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockGetMerchantForApiRequest.mockResolvedValue({
      businessName: 'Test Store',
      merchantId: 'merchant-1',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: { integrations: { manage: true } },
        role: 'owner',
      },
    });
    mockCreateVirtualTerminal.mockResolvedValue({
      data: { code: 'VT_123', paymentMethods: [] },
      success: true,
    });
    mockAdminInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'terminal-1' },
          error: null,
        }),
      }),
    });
    mockAdminFrom.mockReturnValue({ insert: mockAdminInsert });
  });

  it('returns success with a warning when the post-create legacy lookup fails', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'legacy lookup failed' },
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      legacySyncWarning: 'legacy_fetch_failed',
      success: true,
      terminal: { code: 'VT_123', id: 'terminal-1' },
    });
    expect(mockAdminInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VT_123',
        merchant_id: 'merchant-1',
      })
    );
    expect(mockRpc).toHaveBeenCalledWith('get_merchant_virtual_terminal_code', {
      p_merchant_id: 'merchant-1',
    });
    // A failed read short-circuits before any legacy UPDATE.
    expect(mockFrom).not.toHaveBeenCalledWith('merchants');
  });

  it('returns success with a warning when the legacy update fails', async () => {
    const legacyUpdate = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'legacy update failed' },
      }),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    };
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(legacyUpdate);

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      legacySyncWarning: 'legacy_update_failed',
      success: true,
      terminal: { code: 'VT_123', id: 'terminal-1' },
    });
    expect(mockRpc).toHaveBeenCalledWith('get_merchant_virtual_terminal_code', {
      p_merchant_id: 'merchant-1',
    });
    expect(mockFrom).toHaveBeenCalledWith('merchants');
  });

  it('returns success without a warning when the legacy code is already set', async () => {
    mockRpc.mockResolvedValue({ data: 'VT_EXISTING', error: null });

    const response = await POST(createRequest());
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toMatchObject({
      success: true,
      terminal: { code: 'VT_123', id: 'terminal-1' },
    });
    expect(responseBody).not.toHaveProperty('legacySyncWarning');
    expect(mockRpc).toHaveBeenCalledWith('get_merchant_virtual_terminal_code', {
      p_merchant_id: 'merchant-1',
    });
    // When the legacy code is already set no authenticated merchant UPDATE is issued.
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
