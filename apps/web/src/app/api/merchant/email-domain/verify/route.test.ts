import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCheckCsrf,
  mockAuth,
  mockGetMerchant,
  mockMerchantRow,
  mockVerify,
  mockIsZeptomailDomainsConfigured,
  mockSupabase,
} = vi.hoisted(() => ({
  mockCheckCsrf: vi.fn(),
  mockAuth: vi.fn(),
  mockGetMerchant: vi.fn(),
  mockMerchantRow: vi.fn(),
  mockVerify: vi.fn(),
  mockIsZeptomailDomainsConfigured: vi.fn(),
  mockSupabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve(mockMerchantRow()) }),
      }),
    }),
  },
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mockCheckCsrf,
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuth,
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mockGetMerchant,
}));
vi.mock('@/lib/merchant-email-domain', () => ({
  verifyMerchantEmailDomain: mockVerify,
}));
vi.mock('@/lib/zeptomail-domains', () => ({
  isZeptomailDomainsConfigured: mockIsZeptomailDomainsConfigured,
}));

import { POST } from './route';

function req() {
  return {
    method: 'POST',
    headers: new Headers(),
  } as Parameters<typeof POST>[0];
}

describe('POST /api/merchant/email-domain/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsZeptomailDomainsConfigured.mockReturnValue(true);
    mockCheckCsrf.mockResolvedValue({ valid: true });
    mockAuth.mockResolvedValue({
      user: { id: 'u1' },
      error: null,
      supabase: mockSupabase,
    });
    mockGetMerchant.mockResolvedValue({
      merchantId: 'm1',
      merchantSlug: 's',
      staffAccess: { isOwner: true },
    });
    mockMerchantRow.mockReturnValue({ data: { plan_tier: 'pro', slug: 's' } });
  });

  it('returns 403 when CSRF validation fails after authentication', async () => {
    mockCheckCsrf.mockResolvedValue({
      valid: false,
      response: new Response(null, { status: 403 }),
    });
    expect((await POST(req())).status).toBe(403);
    expect(mockAuth).toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });
    expect((await POST(req())).status).toBe(401);
  });

  it('returns 403 when the plan lacks the feature', async () => {
    mockMerchantRow.mockReturnValue({ data: { plan_tier: 'free', slug: 's' } });
    expect((await POST(req())).status).toBe(403);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('re-checks verification for an entitled merchant', async () => {
    mockVerify.mockResolvedValue({ status: 'verified' });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mockVerify).toHaveBeenCalledWith('m1', mockSupabase);
  });

  it('returns 503 when ZeptoMail domain credentials are not configured', async () => {
    mockIsZeptomailDomainsConfigured.mockReturnValue(false);

    const res = await POST(req());

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      code: 'email_domain_provider_unconfigured',
    });
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('returns 409 when verification loses the row race to a new domain', async () => {
    mockVerify.mockRejectedValue(
      new Error('Sending domain changed while verification was in progress')
    );

    expect((await POST(req())).status).toBe(409);
  });

  it('returns 502 when ZeptoMail verification fails', async () => {
    mockVerify.mockRejectedValue(new Error('upstream down'));
    expect((await POST(req())).status).toBe(502);
  });

  it('returns 400 when there is no sending domain to verify', async () => {
    mockVerify.mockRejectedValue(new Error('No sending domain to verify'));
    expect((await POST(req())).status).toBe(400);
  });

  it('returns 500 when local storage fails during verification', async () => {
    mockVerify.mockRejectedValue(new Error('Failed to load email domain'));
    expect((await POST(req())).status).toBe(500);
  });
});
