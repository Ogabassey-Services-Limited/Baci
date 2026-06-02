import { beforeEach, describe, expect, it, vi } from 'vitest';

const oauthRouteMocks = vi.hoisted(() => ({
  domainResult: { data: null, error: { message: 'not found' } },
  signInWithOAuth: vi.fn(),
  slugResult: {
    data: {
      business_name: 'Baci Store',
      id: 'merchant-1',
      is_published: true,
      custom_domain: 'ogabassey.com',
      slug: 'ogabassey',
    },
    error: null,
  },
}));

vi.mock('@/env', () => ({
  getAppUrl: () => 'https://usebaci.com',
  getRootDomain: () => 'usebaci.com',
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: oauthRouteMocks.signInWithOAuth,
    },
    from: () => ({
      select: () => ({
        eq: (column: string) => ({
          single: () =>
            Promise.resolve(
              column === 'slug'
                ? oauthRouteMocks.slugResult
                : oauthRouteMocks.domainResult
            ),
        }),
      }),
    }),
  }),
}));

function makeRequest(body: Record<string, unknown>) {
  return new Request('https://usebaci.com/api/storefront/auth/google', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

describe('POST /api/storefront/auth/google', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    oauthRouteMocks.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://supabase.example/oauth/google' },
      error: null,
    });
  });

  it('rejects cross-origin redirect URLs before starting OAuth', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        redirectUrl: 'https://evil.example/account',
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({
      code: 'INVALID_REDIRECT_URL',
      error: 'Invalid redirectUrl',
    });
    expect(oauthRouteMocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it('allows merchant subdomain redirect URLs after merchant verification', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        redirectUrl: 'https://ogabassey.usebaci.com/account/callback',
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(oauthRouteMocks.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: 'https://ogabassey.usebaci.com/account/callback',
        }),
      })
    );
  });

  it('allows merchant custom-domain redirect URLs after merchant verification', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        redirectUrl: 'https://ogabassey.com/account/callback',
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(oauthRouteMocks.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: 'https://ogabassey.com/account/callback',
        }),
      })
    );
  });

  it('normalizes relative redirect URLs to the configured app origin', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        redirectUrl: '/account?tab=orders',
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(oauthRouteMocks.signInWithOAuth).toHaveBeenCalledWith({
      options: {
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        redirectTo: 'https://usebaci.com/account?tab=orders',
      },
      provider: 'google',
    });
  });
});
