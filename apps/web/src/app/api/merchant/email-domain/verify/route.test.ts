import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetUser, mockGetMerchant, mockMerchantRow, mockVerify } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockGetMerchant: vi.fn(),
    mockMerchantRow: vi.fn(),
    mockVerify: vi.fn(),
  }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: () => ({
        select: () => ({
          eq: () => ({ single: () => Promise.resolve(mockMerchantRow()) }),
        }),
      }),
    }),
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mockGetMerchant,
}));
vi.mock('@/lib/merchant-email-domain', () => ({
  verifyMerchantEmailDomain: mockVerify,
}));

import { POST } from './route';

describe('POST /api/merchant/email-domain/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockGetMerchant.mockResolvedValue({ merchantId: 'm1', merchantSlug: 's' });
    mockMerchantRow.mockReturnValue({ data: { plan_tier: 'pro', slug: 's' } });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await POST()).status).toBe(401);
  });

  it('returns 403 when the plan lacks the feature', async () => {
    mockMerchantRow.mockReturnValue({ data: { plan_tier: 'free', slug: 's' } });
    expect((await POST()).status).toBe(403);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('re-checks verification for an entitled merchant', async () => {
    mockVerify.mockResolvedValue({ status: 'verified' });
    const res = await POST();
    expect(res.status).toBe(200);
    expect(mockVerify).toHaveBeenCalledWith('m1');
  });

  it('returns 502 when ZeptoMail verification fails', async () => {
    mockVerify.mockRejectedValue(new Error('upstream down'));
    expect((await POST()).status).toBe(502);
  });
});
