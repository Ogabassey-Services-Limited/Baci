import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuth,
  mockGetMerchant,
  mockMerchantRow,
  mockGetDomain,
  mockRegister,
  mockSetEnabled,
  mockCheckCsrf,
  mockIsZeptomailDomainsConfigured,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetMerchant: vi.fn(),
  mockMerchantRow: vi.fn(),
  mockGetDomain: vi.fn(),
  mockRegister: vi.fn(),
  mockSetEnabled: vi.fn(),
  mockCheckCsrf: vi.fn(),
  mockIsZeptomailDomainsConfigured: vi.fn(),
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
  getMerchantEmailDomain: mockGetDomain,
  registerMerchantEmailDomain: mockRegister,
  setMerchantEmailDomainEnabled: mockSetEnabled,
}));
vi.mock('@/lib/zeptomail-domains', () => ({
  isZeptomailDomainsConfigured: mockIsZeptomailDomainsConfigured,
}));

import { GET, PATCH, POST } from './route';

function req(body: unknown, method = 'POST'): NextRequest {
  return {
    method,
    headers: new Headers(),
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

function signedInAs(planTier: string | null, slug = 'mystore') {
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve(mockMerchantRow()) }),
      }),
    }),
  };
  mockAuth.mockResolvedValue({
    user: { id: 'u1' },
    error: null,
    supabase,
  });
  mockGetMerchant.mockResolvedValue({
    merchantId: 'm1',
    merchantSlug: slug,
    staffAccess: { isOwner: true },
  });
  mockMerchantRow.mockReturnValue({ data: { plan_tier: planTier, slug } });
  return supabase;
}

describe('POST /api/merchant/email-domain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrf.mockResolvedValue({ valid: true });
    mockIsZeptomailDomainsConfigured.mockReturnValue(true);
  });

  it('returns 403 when CSRF validation fails after authentication', async () => {
    signedInAs('pro');
    mockCheckCsrf.mockResolvedValue({
      valid: false,
      response: new Response(null, { status: 403 }),
    });
    const res = await POST(req({ domain: 'mystore.com' }));
    expect(res.status).toBe(403);
    expect(mockAuth).toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });
    const res = await POST(req({ domain: 'mystore.com' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when the merchant context is missing', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u1' },
      error: null,
      supabase: {},
    });
    mockGetMerchant.mockResolvedValue(null);
    const res = await POST(req({ domain: 'mystore.com' }));
    expect(res.status).toBe(403);
  });

  it('returns 403 when the plan lacks the custom-email-domain feature', async () => {
    signedInAs('free');
    const res = await POST(req({ domain: 'mystore.com' }));
    expect(res.status).toBe(403);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid domain', async () => {
    signedInAs('pro');
    const res = await POST(req({ domain: 'not a domain' }));
    expect(res.status).toBe(400);
  });

  it('registers the domain for an entitled merchant', async () => {
    signedInAs('pro');
    mockRegister.mockResolvedValue({
      domain: 'mystore.com',
      status: 'pending',
    });
    const res = await POST(req({ domain: 'MyStore.com' }));
    expect(res.status).toBe(200);
    expect(mockRegister).toHaveBeenCalledWith('m1', 'mystore.com');
  });

  it('returns 503 when ZeptoMail domain credentials are not configured', async () => {
    signedInAs('pro');
    mockIsZeptomailDomainsConfigured.mockReturnValue(false);

    const res = await POST(req({ domain: 'mystore.com' }));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      code: 'email_domain_provider_unconfigured',
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });
});

describe('GET /api/merchant/email-domain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrf.mockResolvedValue({ valid: true });
    mockIsZeptomailDomainsConfigured.mockReturnValue(true);
  });

  it('returns 403 when the merchant lacks entitlement', async () => {
    signedInAs('free');
    const res = await GET(req(null, 'GET'));
    expect(res.status).toBe(403);
    expect(mockGetDomain).not.toHaveBeenCalled();
  });

  it('returns the current domain config', async () => {
    const supabase = signedInAs('pro');
    mockGetDomain.mockResolvedValue({
      domain: 'mystore.com',
      status: 'verified',
    });
    const res = await GET(req(null, 'GET'));
    expect(res.status).toBe(200);
    expect(mockGetDomain).toHaveBeenCalledWith('m1', supabase);
    await expect(res.json()).resolves.toEqual({
      domain: { domain: 'mystore.com', status: 'verified' },
    });
  });

  it('returns a JSON 500 when loading the domain config fails', async () => {
    signedInAs('pro');
    mockGetDomain.mockRejectedValue(new Error('Failed to load email domain'));
    const res = await GET(req(null, 'GET'));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      code: 'email_domain_load_failed',
    });
  });

  it('returns 500 (not 403) when the merchant lookup query errors', async () => {
    // A real DB read failure is a server error, not an authorization denial.
    mockAuth.mockResolvedValue({
      user: { id: 'u1' },
      error: null,
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: null,
                  error: { code: 'XX000', message: 'db down' },
                }),
            }),
          }),
        }),
      },
    });
    mockGetMerchant.mockResolvedValue({
      merchantId: 'm1',
      merchantSlug: 'mystore',
      staffAccess: { isOwner: true },
    });
    const res = await GET(req(null, 'GET'));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      code: 'merchant_lookup_failed',
    });
  });
});

describe('PATCH /api/merchant/email-domain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrf.mockResolvedValue({ valid: true });
    mockIsZeptomailDomainsConfigured.mockReturnValue(true);
  });

  it('returns 403 when CSRF validation fails after authentication', async () => {
    signedInAs('pro');
    mockCheckCsrf.mockResolvedValue({
      valid: false,
      response: new Response(null, { status: 403 }),
    });
    const res = await PATCH(req({ enabled: true }, 'PATCH'));
    expect(res.status).toBe(403);
    expect(mockSetEnabled).not.toHaveBeenCalled();
  });

  it('enables sending for an entitled merchant', async () => {
    signedInAs('pro');
    mockSetEnabled.mockResolvedValue({ enabled: true });
    const res = await PATCH(req({ enabled: true }, 'PATCH'));
    expect(res.status).toBe(200);
    expect(mockSetEnabled).toHaveBeenCalledWith('m1', true);
  });

  it('returns 400 when the body is invalid', async () => {
    signedInAs('pro');
    const res = await PATCH(req({ enabled: 'yes' }, 'PATCH'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for verified-only business rule failures', async () => {
    signedInAs('pro');
    mockSetEnabled.mockRejectedValue(
      new Error('Domain must be verified before enabling')
    );
    const res = await PATCH(req({ enabled: true }, 'PATCH'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when toggling after the sending-domain row was removed', async () => {
    signedInAs('pro');
    mockSetEnabled.mockRejectedValue(new Error('No sending domain to update'));

    const res = await PATCH(req({ enabled: false }, 'PATCH'));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: 'No sending domain to update',
    });
  });

  it('returns 500 for storage failures when toggling', async () => {
    signedInAs('pro');
    mockSetEnabled.mockRejectedValue(
      new Error('Failed to update email domain')
    );
    const res = await PATCH(req({ enabled: true }, 'PATCH'));
    expect(res.status).toBe(500);
  });

  it('returns 500 with email_domain_update_failed for unexpected toggle errors', async () => {
    signedInAs('pro');
    // Not a business-rule and not a storage error → generic 500 branch.
    mockSetEnabled.mockRejectedValue(new Error('unexpected boom'));
    const res = await PATCH(req({ enabled: true }, 'PATCH'));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      code: 'email_domain_update_failed',
    });
  });
});

describe('POST /api/merchant/email-domain business rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrf.mockResolvedValue({ valid: true });
    mockIsZeptomailDomainsConfigured.mockReturnValue(true);
  });

  it('returns 400 when the domain is not an active storefront domain', async () => {
    signedInAs('pro');
    mockRegister.mockRejectedValue(
      new Error(
        'Domain must be an active verified storefront domain before email sending can be configured'
      )
    );

    const res = await POST(req({ domain: 'mystore.com' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('active verified storefront domain'),
    });
  });

  it('returns 409 when the domain is already reserved', async () => {
    signedInAs('pro');
    mockRegister.mockRejectedValue(
      new Error('Domain is already registered by another merchant')
    );

    const res = await POST(req({ domain: 'mystore.com' }));

    expect(res.status).toBe(409);
  });

  it('returns 500 with email_domain_storage_failed when persistence fails', async () => {
    signedInAs('pro');
    mockRegister.mockRejectedValue(
      new Error('Failed to save email domain: db unavailable')
    );

    const res = await POST(req({ domain: 'mystore.com' }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      code: 'email_domain_storage_failed',
    });
  });

  it('returns 502 with email_domain_upstream_failed when the provider fails', async () => {
    signedInAs('pro');
    mockRegister.mockRejectedValue(new Error('ZeptoMail API error (500)'));

    const res = await POST(req({ domain: 'mystore.com' }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({
      code: 'email_domain_upstream_failed',
    });
  });
});
