import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendCodeMocks = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetMerchantByIdentifier: vi.fn(),
  mockSignInWithOtp: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    sendCodeMocks.mockGetMerchantByIdentifier(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithOtp: sendCodeMocks.mockSignInWithOtp,
    },
    from: sendCodeMocks.mockFrom,
  })),
}));

import { POST } from './route';

interface MockMerchant {
  business_name: string;
  custom_domain: string | null;
  id: string;
  is_published: boolean;
  slug: string;
}

const ogabasseyMerchant: MockMerchant = {
  business_name: 'Ogabassey',
  custom_domain: 'ogabassey.com',
  id: 'merchant-1',
  is_published: true,
  slug: 'ogabassey',
};

function makeRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  return new Request('https://ogabassey.com/api/storefront/auth/send-code', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
    method: 'POST',
  });
}

describe('POST /api/storefront/auth/send-code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    sendCodeMocks.mockGetMerchantByIdentifier.mockResolvedValue(
      ogabasseyMerchant
    );
    sendCodeMocks.mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  it('uses the current merchant custom-domain origin for OTP email redirects', async () => {
    const response = await POST(
      makeRequest(
        { email: 'customer@example.com', merchantSlug: 'ogabassey' },
        { origin: 'https://ogabassey.com' }
      )
    );

    expect(response.status).toBe(200);
    expect(sendCodeMocks.mockGetMerchantByIdentifier).toHaveBeenCalledWith(
      'ogabassey'
    );
    expect(sendCodeMocks.mockFrom).not.toHaveBeenCalled();
    expect(sendCodeMocks.mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'customer@example.com',
      options: expect.objectContaining({
        emailRedirectTo: 'https://ogabassey.com/account/verify',
      }),
    });
  });

  it('falls back to the merchant custom domain in production when the origin is untrusted', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const response = await POST(
      makeRequest(
        { email: 'customer@example.com', merchantSlug: 'ogabassey' },
        { origin: 'https://evil.example' }
      )
    );

    expect(response.status).toBe(200);
    expect(sendCodeMocks.mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'customer@example.com',
      options: expect.objectContaining({
        emailRedirectTo: 'https://ogabassey.com/account/verify',
      }),
    });
  });

  it('uses the merchant subdomain when the merchant has no custom domain', async () => {
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'usebaci.com');
    sendCodeMocks.mockGetMerchantByIdentifier.mockResolvedValue({
      ...ogabasseyMerchant,
      custom_domain: null,
    });

    const response = await POST(
      makeRequest({ email: 'customer@example.com', merchantSlug: 'ogabassey' })
    );

    expect(response.status).toBe(200);
    expect(sendCodeMocks.mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'customer@example.com',
      options: expect.objectContaining({
        emailRedirectTo: 'http://ogabassey.usebaci.com/account/verify',
      }),
    });
  });

  it('returns 404 when the storefront merchant resolver misses', async () => {
    sendCodeMocks.mockGetMerchantByIdentifier.mockResolvedValue(null);

    const response = await POST(
      makeRequest({
        email: 'customer@example.com',
        merchantSlug: 'missing-store',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Store not found' });
    expect(sendCodeMocks.mockSignInWithOtp).not.toHaveBeenCalled();
  });
});
