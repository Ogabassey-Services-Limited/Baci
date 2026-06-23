import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendCodeMocks = vi.hoisted(() => ({
  mockCheckStorefrontOtpSendLimit: vi.fn(),
  mockFrom: vi.fn(),
  mockResolveStorefrontAuthMerchant: vi.fn(),
  mockSignInWithOtp: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('../resolve-storefront-auth-merchant', () => ({
  resolveStorefrontAuthMerchant: (...args: unknown[]) =>
    sendCodeMocks.mockResolveStorefrontAuthMerchant(...args),
}));

vi.mock('@/lib/storefront-auth-abuse', () => ({
  checkStorefrontOtpSendLimit: (...args: unknown[]) =>
    sendCodeMocks.mockCheckStorefrontOtpSendLimit(...args),
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
    sendCodeMocks.mockResolveStorefrontAuthMerchant.mockResolvedValue(
      ogabasseyMerchant
    );
    sendCodeMocks.mockSignInWithOtp.mockResolvedValue({ error: null });
    sendCodeMocks.mockCheckStorefrontOtpSendLimit.mockResolvedValue({
      allowed: true,
      captchaRequired: false,
      limit: 3,
      remaining: 2,
      resetTime: Date.now() + 60_000,
    });
  });

  it('uses the current merchant custom-domain origin for OTP email redirects', async () => {
    const response = await POST(
      makeRequest(
        { email: 'customer@example.com', merchantSlug: 'ogabassey' },
        { origin: 'https://ogabassey.com' }
      )
    );

    expect(response.status).toBe(200);
    expect(
      sendCodeMocks.mockResolveStorefrontAuthMerchant
    ).toHaveBeenCalledWith(expect.anything(), 'ogabassey');
    expect(sendCodeMocks.mockFrom).not.toHaveBeenCalled();
    expect(sendCodeMocks.mockCheckStorefrontOtpSendLimit).toHaveBeenCalledWith({
      captchaToken: undefined,
      email: 'customer@example.com',
      merchantId: 'merchant-1',
    });
    expect(sendCodeMocks.mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'customer@example.com',
      options: expect.objectContaining({
        data: expect.objectContaining({
          pending_merchant_id: 'merchant-1',
          role: 'customer',
        }),
        emailRedirectTo: 'https://ogabassey.com/account/verify',
      }),
    });
  });

  it('passes captcha tokens through to Supabase OTP sends', async () => {
    const response = await POST(
      makeRequest({
        captchaToken: 'captcha-token',
        email: 'customer@example.com',
        merchantSlug: 'ogabassey',
      })
    );

    expect(response.status).toBe(200);
    expect(sendCodeMocks.mockCheckStorefrontOtpSendLimit).toHaveBeenCalledWith({
      captchaToken: 'captcha-token',
      email: 'customer@example.com',
      merchantId: 'merchant-1',
    });
    expect(sendCodeMocks.mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'customer@example.com',
      options: expect.objectContaining({
        captchaToken: 'captcha-token',
      }),
    });
  });

  it('requires captcha when the durable identifier limiter crosses its challenge threshold', async () => {
    sendCodeMocks.mockCheckStorefrontOtpSendLimit.mockResolvedValueOnce({
      allowed: true,
      captchaRequired: true,
      limit: 3,
      remaining: 0,
      resetTime: Date.now() + 60_000,
    });

    const response = await POST(
      makeRequest({ email: 'customer@example.com', merchantSlug: 'ogabassey' })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: 'CAPTCHA_REQUIRED',
      error: 'Please complete the verification challenge and try again.',
    });
    expect(sendCodeMocks.mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it('blocks sends when the durable identifier limiter is exhausted', async () => {
    sendCodeMocks.mockCheckStorefrontOtpSendLimit.mockResolvedValueOnce({
      allowed: false,
      captchaRequired: false,
      limit: 3,
      remaining: 0,
      resetTime: Date.now() + 60_000,
    });

    const response = await POST(
      makeRequest({ email: 'customer@example.com', merchantSlug: 'ogabassey' })
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: 'Too many requests. Please wait a moment and try again.',
    });
    expect(sendCodeMocks.mockSignInWithOtp).not.toHaveBeenCalled();
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
    sendCodeMocks.mockResolveStorefrontAuthMerchant.mockResolvedValue({
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

  it('keeps a custom-domain identifier on the custom-domain redirect', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'usebaci.com');

    const response = await POST(
      makeRequest({
        email: 'customer@example.com',
        merchantSlug: 'ogabassey.com',
      })
    );

    expect(response.status).toBe(200);
    expect(
      sendCodeMocks.mockResolveStorefrontAuthMerchant
    ).toHaveBeenCalledWith(expect.anything(), 'ogabassey.com');
    expect(sendCodeMocks.mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'customer@example.com',
      options: expect.objectContaining({
        emailRedirectTo: 'https://ogabassey.com/account/verify',
      }),
    });
  });

  it('returns 403 without sending OTP when the store is unpublished', async () => {
    sendCodeMocks.mockResolveStorefrontAuthMerchant.mockResolvedValue({
      ...ogabasseyMerchant,
      is_published: false,
    });

    const response = await POST(
      makeRequest({ email: 'customer@example.com', merchantSlug: 'ogabassey' })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Store is not available' });
    expect(sendCodeMocks.mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it('returns 429 when Supabase reports the OTP email rate limit by status and code', async () => {
    sendCodeMocks.mockSignInWithOtp.mockResolvedValue({
      error: {
        code: 'over_email_send_rate_limit',
        message:
          'For security purposes, you can only request this after 4 seconds.',
        status: 429,
      },
    });

    const response = await POST(
      makeRequest({ email: 'customer@example.com', merchantSlug: 'ogabassey' })
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: 'Too many requests. Please wait a moment and try again.',
    });
  });

  it('does not treat unrelated Supabase errors containing the substring rate as throttling', async () => {
    sendCodeMocks.mockSignInWithOtp.mockResolvedValue({
      error: {
        code: 'unexpected_failure',
        message: 'Please use a separate email address.',
        status: 500,
      },
    });

    const response = await POST(
      makeRequest({ email: 'customer@example.com', merchantSlug: 'ogabassey' })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Failed to send verification code. Please try again.',
    });
  });

  it('returns 404 when the storefront merchant resolver misses', async () => {
    sendCodeMocks.mockResolveStorefrontAuthMerchant.mockResolvedValue(null);

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
