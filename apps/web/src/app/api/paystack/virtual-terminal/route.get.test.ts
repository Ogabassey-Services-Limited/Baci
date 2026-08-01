import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createClient: vi.fn(),
  getMerchant: vi.fn(),
}));
const terminals = {
  eq: vi.fn().mockReturnThis(),
  order: vi.fn(),
  select: vi.fn().mockReturnThis(),
};
const supabase = { from: vi.fn(() => terminals) };
const merchantId = '11111111-1111-4111-8111-111111111111';

vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({})) }));
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticate,
  hasPermission: vi.fn(() => true),
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchant,
  toUserAccess: vi.fn((context) => context),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

import { GET } from './route';

describe('GET /api/paystack/virtual-terminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue(supabase);
    mocks.authenticate.mockResolvedValue({
      error: null,
      supabase,
      user: { id: 'user-1' },
    });
    mocks.getMerchant.mockResolvedValue({
      merchantId,
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: {},
        role: null,
      },
    });
    terminals.order.mockResolvedValue({
      data: [{ active: true, code: 'VT_001', id: 'terminal-1', name: 'Main' }],
      error: null,
    });
  });

  it('returns 401 when the requester is unauthenticated', async () => {
    mocks.authenticate.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });

    const response = await GET(
      new NextRequest('https://usebaci.com/api/paystack/virtual-terminal')
    );

    expect(response.status).toBe(401);
  });

  it('rejects list requests without an explicit merchant context', async () => {
    const response = await GET(
      new NextRequest('https://usebaci.com/api/paystack/virtual-terminal')
    );

    expect(response.status).toBe(400);
    expect(mocks.getMerchant).not.toHaveBeenCalled();
    expect(terminals.eq).not.toHaveBeenCalled();
  });

  it('lists terminals only after authorizing the selected merchant', async () => {
    const response = await GET(
      new NextRequest(
        `https://usebaci.com/api/paystack/virtual-terminal?merchantId=${merchantId}`
      )
    );

    expect(response.status).toBe(200);
    expect(terminals.eq).toHaveBeenCalledWith('merchant_id', merchantId);
  });
});
