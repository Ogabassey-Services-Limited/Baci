import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  createClient: vi.fn(),
  getMerchant: vi.fn(),
  getUser: vi.fn(),
}));
const supabase = { auth: { getUser: mocks.getUser }, from: vi.fn() };
const merchantId = '22222222-2222-4222-8222-222222222222';

vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({})) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchant,
  toUserAccess: vi.fn((context) => context),
}));
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticateApiRequest,
  hasPermission: vi.fn(() => true),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));
vi.mock('@/lib/paystack', () => ({ createVirtualTerminal: vi.fn() }));

import { POST } from './route';

describe('POST /api/paystack/virtual-terminal request validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateApiRequest.mockResolvedValue({
      error: null,
      supabase,
      user: { id: 'user-1' },
    });
    mocks.createClient.mockReturnValue(supabase);
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.getMerchant.mockResolvedValue({
      businessName: 'Test Biz',
      merchantId,
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: {},
        role: null,
      },
    });
  });

  it('rejects a terminal name shorter than the schema minimum', async () => {
    const response = await POST(
      new NextRequest('https://usebaci.com/api/paystack/virtual-terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId, name: 'X' }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.getMerchant).not.toHaveBeenCalled();
  });
});
