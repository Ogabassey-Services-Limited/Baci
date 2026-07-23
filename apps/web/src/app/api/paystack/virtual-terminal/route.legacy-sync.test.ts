import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockAdminFrom = vi.fn();
const mockCreateAdminClient = vi.fn(() => ({ from: mockAdminFrom }));
const mockCreateVirtualTerminal = vi.fn();

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
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
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
    body: JSON.stringify({ name: 'Sales Terminal' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

describe('POST /api/paystack/virtual-terminal legacy sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('returns success with a warning when the post-create legacy lookup fails', async () => {
    const terminalInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'terminal-1' },
        error: null,
      }),
    };
    // Only the virtual_terminals insert runs on the admin client now.
    mockAdminFrom.mockReturnValue(terminalInsert);
    // The secret `virtual_terminal_code` read is served by the bounded
    // SECURITY DEFINER RPC on the authenticated client.
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
    // The revoked secret column is read through the bounded RPC on the
    // authenticated client, never a service-role client.
    expect(mockRpc).toHaveBeenCalledWith('get_merchant_virtual_terminal_code', {
      p_merchant_id: 'merchant-1',
    });
    expect(mockAdminFrom).not.toHaveBeenCalledWith('merchants');
    // A failed read short-circuits before any legacy UPDATE.
    expect(mockFrom).not.toHaveBeenCalledWith('merchants');
  });

  it('returns success with a warning when the legacy update fails', async () => {
    const terminalInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'terminal-1' },
        error: null,
      }),
    };
    const legacyUpdate = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'legacy update failed' },
      }),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    };
    // Insert runs on the admin client; the secret-column read is the bounded RPC
    // on the authenticated client; the SET-only UPDATE (filtered by id) stays on
    // the authenticated client.
    mockAdminFrom.mockReturnValue(terminalInsert);
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(legacyUpdate);

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      legacySyncWarning: 'legacy_update_failed',
      success: true,
      terminal: { code: 'VT_123', id: 'terminal-1' },
    });
    // The secret read uses the bounded RPC; the SET-only legacy UPDATE remains on
    // the authenticated client and the secret column is never read via admin.
    expect(mockRpc).toHaveBeenCalledWith('get_merchant_virtual_terminal_code', {
      p_merchant_id: 'merchant-1',
    });
    expect(mockFrom).toHaveBeenCalledWith('merchants');
    expect(mockAdminFrom).not.toHaveBeenCalledWith('merchants');
  });

  it('returns success without a warning when the legacy code is already set', async () => {
    const terminalInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'terminal-1' },
        error: null,
      }),
    };
    mockAdminFrom.mockReturnValue(terminalInsert);
    // The bounded RPC reports an existing legacy code on the authenticated client.
    mockRpc.mockResolvedValue({ data: 'VT_EXISTING', error: null });

    const response = await POST(createRequest());
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toMatchObject({
      success: true,
      terminal: { code: 'VT_123', id: 'terminal-1' },
    });
    expect(responseBody).not.toHaveProperty('legacySyncWarning');
    // The read is served by the bounded RPC on the authenticated client.
    expect(mockRpc).toHaveBeenCalledWith('get_merchant_virtual_terminal_code', {
      p_merchant_id: 'merchant-1',
    });
    // When the legacy code is already set no authenticated UPDATE is issued.
    expect(mockFrom).not.toHaveBeenCalled();
    // The secret column is never read through a service-role client.
    expect(mockAdminFrom).not.toHaveBeenCalledWith('merchants');
  });
});
