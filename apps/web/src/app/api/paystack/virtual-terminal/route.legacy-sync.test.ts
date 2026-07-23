import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockFrom = vi.fn();
const mockCreateVirtualTerminal = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({})),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
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
    const legacyLookup = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'legacy lookup failed' },
      }),
    };
    mockFrom.mockImplementation((table: string) =>
      table === 'virtual_terminals' ? terminalInsert : legacyLookup
    );

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      legacySyncWarning: 'legacy_fetch_failed',
      success: true,
      terminal: { code: 'VT_123', id: 'terminal-1' },
    });
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
    const legacyLookup = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { virtual_terminal_code: null },
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
    mockFrom
      .mockReturnValueOnce(terminalInsert)
      .mockReturnValueOnce(legacyLookup)
      .mockReturnValueOnce(legacyUpdate);

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      legacySyncWarning: 'legacy_update_failed',
      success: true,
      terminal: { code: 'VT_123', id: 'terminal-1' },
    });
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
    const legacyLookup = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { virtual_terminal_code: 'VT_EXISTING' },
        error: null,
      }),
    };
    mockFrom
      .mockReturnValueOnce(terminalInsert)
      .mockReturnValueOnce(legacyLookup);

    const response = await POST(createRequest());
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toMatchObject({
      success: true,
      terminal: { code: 'VT_123', id: 'terminal-1' },
    });
    expect(responseBody).not.toHaveProperty('legacySyncWarning');
  });
});
