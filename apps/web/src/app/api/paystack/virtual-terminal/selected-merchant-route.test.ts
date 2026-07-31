import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  createClient: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  hasPermission: vi.fn(() => true),
  validateTerminalAssignments: vi.fn(() => Promise.resolve({ error: null })),
}));

const merchantB = '22222222-2222-4222-8222-222222222222';
const terminalQuery = {
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
  select: vi.fn().mockReturnThis(),
};
const supabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(() => terminalQuery),
};

vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({})) }));
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticateApiRequest,
  hasPermission: mocks.hasPermission,
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchantForApiRequest,
  toUserAccess: vi.fn((context) => ({ merchantId: context.merchantId })),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => supabase),
}));
vi.mock('@/lib/paystack', () => ({
  createVirtualTerminal: vi.fn(() =>
    Promise.resolve({ success: false, error: 'stop after authorization' })
  ),
}));
vi.mock('./validate-terminal-assignments', () => ({
  validateTerminalAssignments: mocks.validateTerminalAssignments,
}));

import { GET, POST } from './route';

describe('virtual terminal selected merchant context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-a' } },
    });
    mocks.createClient.mockReturnValue(supabase);
    mocks.authenticateApiRequest.mockResolvedValue({
      error: null,
      supabase,
      user: { id: 'user-a' },
    });
    mocks.getMerchantForApiRequest.mockResolvedValue({
      businessName: 'Merchant B',
      merchantId: merchantB,
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: {},
        role: null,
      },
    });
  });

  it('authorizes the selected merchant before listing terminals', async () => {
    const response = await GET(
      new NextRequest(
        `https://usebaci.com/api/paystack/virtual-terminal?merchantId=${merchantB}`
      )
    );

    expect(response.status).toBe(200);
    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      supabase,
      'user-a',
      { requestedMerchantId: merchantB }
    );
    expect(terminalQuery.eq).toHaveBeenCalledWith('merchant_id', merchantB);
  });

  it('authorizes the selected merchant before creating a terminal', async () => {
    const response = await POST(
      new NextRequest('https://usebaci.com/api/paystack/virtual-terminal', {
        method: 'POST',
        body: JSON.stringify({
          merchantId: merchantB,
          name: 'Merchant B Till',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      supabase,
      'user-a',
      { requestedMerchantId: merchantB }
    );
  });

  it('creates a terminal for a selected merchant with mobile bearer auth', async () => {
    const request = new NextRequest(
      'https://usebaci.com/api/paystack/virtual-terminal',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer mobile-access-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId: merchantB,
          name: 'Merchant B Till',
        }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mocks.authenticateApiRequest).toHaveBeenCalledWith(request);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      supabase,
      'user-a',
      { requestedMerchantId: merchantB }
    );
  });
});
