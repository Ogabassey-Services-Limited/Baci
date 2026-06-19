import type { User } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STOREFRONT_AGENT_ROUTES } from '@/config/storefront-agent-routes';
import { STOREFRONT_FEED_ROUTES } from '@/config/storefront-feed-routes';
import {
  getCustomDomainForSlug,
  getSlugForCustomDomain,
} from '@/lib/domain-cache-simple';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveStorefrontProductSlugResolution } from '@/lib/storefront-product-slug-membership';
import { updateSession } from '@/lib/supabase/middleware';
import { STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM } from './config/storefront-metadata-cache-bots';
import { config, proxy } from './proxy';

const AUTHENTICATED_USER: User = {
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2026-03-23T00:00:00.000Z',
  id: 'merchant-user-id',
  user_metadata: {},
};
const MACHINE_READABLE_TEST_PATHS = [
  ...Object.values(STOREFRONT_AGENT_ROUTES),
  ...Object.values(STOREFRONT_FEED_ROUTES),
];

// Mock dependencies
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: vi.fn().mockResolvedValue({
    supabaseResponse: NextResponse.next(),
    user: null, // Simulate unauthenticated by default
  }),
}));

vi.mock('@/lib/ad-tracking-cookies', () => ({
  CLICK_ID_PARAMS: {},
  extractClickIdsFromUrl: vi.fn().mockReturnValue({}),
  generateClickIdCookies: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/domain-cache-simple', () => ({
  getCustomDomainForSlug: vi.fn().mockResolvedValue(null),
  getSlugForCustomDomain: vi.fn().mockResolvedValue('ogabassey'),
}));

// Mock env
vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://example.supabase.co',
  getSupabaseAnonKey: () => 'anon-key',
  getInternalApiSecret: () => 'test-internal-secret',
}));

// Mock the crawl-budget product-slug membership check (PR-B §3.2). Defaults to
// "present" so it is a no-op for existing tests; individual tests override it.
vi.mock('@/lib/storefront-product-slug-membership', () => ({
  resolveStorefrontProductSlugResolution: vi
    .fn()
    .mockResolvedValue({ kind: 'present-or-unknown' }),
}));

// Mock rate limit
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({
    allowed: true,
    limit: 100,
    remaining: 99,
    resetTime: Date.now() + 60000,
  }),
  createRateLimitResponse: vi
    .fn()
    .mockReturnValue(new NextResponse('Too Many Requests', { status: 429 })),
}));

function assertNonceHeadersForwarded(
  forwardedRequest: NextRequest | undefined,
  response: NextResponse
) {
  if (!forwardedRequest) {
    throw new Error('expected updateSession to receive a forwarded request');
  }

  const nonce = forwardedRequest.headers.get('x-nonce');
  const forwardedCsp = forwardedRequest.headers.get('Content-Security-Policy');
  const responseCsp = response.headers.get('Content-Security-Policy');

  if (!nonce) {
    throw new Error('missing x-nonce header');
  }
  if (!forwardedCsp) {
    throw new Error('missing forwarded Content-Security-Policy header');
  }
  if (!responseCsp) {
    throw new Error('missing response Content-Security-Policy header');
  }

  expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(forwardedCsp).toContain(`'nonce-${nonce}'`);
  expect(responseCsp).toContain(`'nonce-${nonce}'`);
  expect(responseCsp).toContain(`script-src 'self' 'nonce-${nonce}'`);
  expect(responseCsp).not.toContain('script-src-elem');
  expect(responseCsp).toContain("script-src-attr 'none'");
  expect(responseCsp).toBe(forwardedCsp);
}

describe('Middleware Proxy', () => {
  const ROOT_DOMAIN = 'usebaci.com';

  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks resets call history but not implementations; restore the
    // crawl-budget membership mock to its "present" default so a per-test
    // override does not leak into unrelated custom-domain tests.
    vi.mocked(resolveStorefrontProductSlugResolution).mockResolvedValue({
      kind: 'present-or-unknown',
    });
  });

  it('should apply security headers to API routes', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/api/products`);
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(res.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin'
    );
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()');

    // API specific CSP
    const csp = res.headers.get('Content-Security-Policy') || '';
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('should apply security headers to storefront routes', async () => {
    const req = new NextRequest(`https://ogabassey.${ROOT_DOMAIN}/products`);
    req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

    const res = await proxy(req);

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');

    // Storefront specific CSP
    const csp = res.headers.get('Content-Security-Policy') || '';
    expect(csp).toContain("frame-ancestors 'self'");
  });

  it('allows Klump checkout hosts on storefront CSP', async () => {
    const req = new NextRequest(`https://ogabassey.${ROOT_DOMAIN}/products`);
    req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

    const res = await proxy(req);
    const csp = res.headers.get('Content-Security-Policy') || '';
    const directives = Object.fromEntries(
      csp
        .split(';')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [name, ...values] = entry.split(/\s+/);
          return [name, values.join(' ')];
        })
    );

    expect(directives['script-src']).toContain('https://js.useklump.com');
    expect(directives['script-src']).toContain('https://asset.useklump.com');
    expect(directives['connect-src']).toContain(
      'https://checkout.useklump.com'
    );
    expect(directives['connect-src']).toContain(
      'https://checkout-v2.useklump.com'
    );
    expect(directives['connect-src']).toContain(
      'https://directdebit.useklump.com'
    );
    expect(directives['frame-src']).toContain('https://asset.useklump.com');
    expect(directives['frame-src']).toContain('https://checkout.useklump.com');
    expect(directives['frame-src']).toContain(
      'https://checkout-v2.useklump.com'
    );
    expect(directives['frame-src']).toContain(
      'https://directdebit.useklump.com'
    );
  });

  it('allows Cloudflare Insights beacon hosts on storefront CSP', async () => {
    const req = new NextRequest(`https://ogabassey.${ROOT_DOMAIN}/products`);
    req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

    const res = await proxy(req);
    const csp = res.headers.get('Content-Security-Policy') || '';
    const directives = Object.fromEntries(
      csp
        .split(';')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [name, ...values] = entry.split(/\s+/);
          return [name, values.join(' ')];
        })
    );

    expect(directives['script-src']).toContain(
      'https://static.cloudflareinsights.com'
    );
    expect(directives['connect-src']).toContain(
      'https://cloudflareinsights.com'
    );
  });

  it('does not allow unsafe-eval on production storefront routes', async () => {
    const req = new NextRequest(`https://ogabassey.${ROOT_DOMAIN}/products`);
    req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

    const res = await proxy(req);
    const csp = res.headers.get('Content-Security-Policy') || '';

    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('allows unsafe-eval on localhost storefront routes for dev tooling', async () => {
    const req = new NextRequest('http://localhost:3001/products');
    req.headers.set('host', 'localhost:3001');

    const res = await proxy(req);
    const csp = res.headers.get('Content-Security-Policy') || '';

    expect(csp).toContain("'unsafe-eval'");
  });

  it('allows unsafe-eval on localhost dashboard routes for dev React tooling', async () => {
    const req = new NextRequest('http://localhost:3001/dashboard/orders');
    req.headers.set('host', 'localhost:3001');

    const res = await proxy(req);
    const csp = res.headers.get('Content-Security-Policy') || '';

    expect(csp).toContain("'unsafe-eval'");
  });

  it('does not allow unsafe-eval on production dashboard routes', async () => {
    vi.mocked(updateSession).mockResolvedValueOnce({
      supabaseResponse: NextResponse.next(),
      user: AUTHENTICATED_USER,
    });

    const req = new NextRequest(`https://${ROOT_DOMAIN}/dashboard/orders`);
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);
    const csp = res.headers.get('Content-Security-Policy') || '';

    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('forwards auth route CSP and nonce headers for Next script nonces', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/login`);
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);
    expect(updateSession).toHaveBeenCalledTimes(1);
    const [forwardedRequest] = vi.mocked(updateSession).mock.calls[0] ?? [];

    assertNonceHeadersForwarded(forwardedRequest, res);
  });

  it('forwards admin route CSP and nonce headers before auth rendering', async () => {
    vi.mocked(updateSession).mockResolvedValueOnce({
      supabaseResponse: NextResponse.next(),
      user: AUTHENTICATED_USER,
    });

    const req = new NextRequest(`https://${ROOT_DOMAIN}/admin/merchants`);
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);
    expect(updateSession).toHaveBeenCalledTimes(1);
    const [forwardedRequest] = vi.mocked(updateSession).mock.calls[0] ?? [];

    assertNonceHeadersForwarded(forwardedRequest, res);
  });

  it('forwards nonce headers for public onboarding renders', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/onboarding`);
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);
    const nonce = res.headers.get('x-nonce');
    const csp = res.headers.get('Content-Security-Policy');

    expect(updateSession).not.toHaveBeenCalled();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}'`);
    expect(csp).not.toContain("'nonce-undefined'");
    const directives = Object.fromEntries(
      (csp ?? '')
        .split(';')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [name, ...values] = entry.split(/\s+/);
          return [name, values.join(' ')];
        })
    );
    expect(directives['script-src']).not.toContain("'unsafe-inline'");
    expect(res.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
    expect(
      res.headers.get('x-middleware-request-content-security-policy')
    ).toBe(csp);
  });

  it('generates unique CSP nonces for repeated auth renders', async () => {
    const nonces: string[] = [];

    for (let index = 0; index < 3; index += 1) {
      const req = new NextRequest(`https://${ROOT_DOMAIN}/login`);
      req.headers.set('host', ROOT_DOMAIN);

      await proxy(req);
      const forwardedRequest = vi.mocked(updateSession).mock.calls[index]?.[0];
      const nonce = forwardedRequest?.headers.get('x-nonce');

      expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
      if (nonce) {
        nonces.push(nonce);
      }
    }

    expect(new Set(nonces).size).toBe(nonces.length);
  });

  it('falls back to a safe nonce when random byte generation fails', async () => {
    const getRandomValuesSpy = vi
      .spyOn(crypto, 'getRandomValues')
      .mockImplementationOnce(() => {
        throw new Error('entropy unavailable');
      });

    const req = new NextRequest(`https://${ROOT_DOMAIN}/login`);
    req.headers.set('host', ROOT_DOMAIN);

    try {
      const res = await proxy(req);
      expect(updateSession).toHaveBeenCalledTimes(1);
      const [forwardedRequest] = vi.mocked(updateSession).mock.calls[0] ?? [];

      assertNonceHeadersForwarded(forwardedRequest, res);
    } finally {
      getRandomValuesSpy.mockRestore();
    }
  });

  it('redirects unauthenticated admin requests to login with the canonical redirect key', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/admin`);
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);
    const location = res.headers.get('location');

    expect(res.status).toBe(307);
    if (!location) {
      throw new Error('expected location header');
    }

    const redirected = new URL(location);
    expect(redirected.pathname).toBe('/login');
    expect(redirected.searchParams.get('redirect')).toBe('/admin');
    expect(redirected.searchParams.has('redirectTo')).toBe(false);
  });

  it('preserves admin subpaths in canonical login redirects', async () => {
    const req = new NextRequest(
      `https://${ROOT_DOMAIN}/admin/merchants?health=at_risk`
    );
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);
    const location = res.headers.get('location');

    expect(res.status).toBe(307);
    if (!location) {
      throw new Error('expected location header');
    }

    const redirected = new URL(location);
    expect(redirected.pathname).toBe('/login');
    expect(redirected.searchParams.get('redirect')).toBe(
      '/admin/merchants?health=at_risk'
    );
  });

  it('redirects authenticated login requests using canonical redirect before legacy redirectTo', async () => {
    vi.mocked(updateSession).mockResolvedValueOnce({
      supabaseResponse: NextResponse.next(),
      user: AUTHENTICATED_USER,
    });

    const req = new NextRequest(
      `https://${ROOT_DOMAIN}/login?redirect=%2Fadmin&redirectTo=%2Fdashboard`
    );
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`https://${ROOT_DOMAIN}/admin`);
  });

  it('keeps legacy redirectTo login compatibility for authenticated users', async () => {
    vi.mocked(updateSession).mockResolvedValueOnce({
      supabaseResponse: NextResponse.next(),
      user: AUTHENTICATED_USER,
    });

    const req = new NextRequest(
      `https://${ROOT_DOMAIN}/login?redirectTo=%2Fadmin`
    );
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`https://${ROOT_DOMAIN}/admin`);
  });

  describe('login redirect path sanitization', () => {
    // Each case proves the proxy's `redirect` param sanitizer prevents an
    // open-redirect or header-injection vector for an authenticated user
    // landing on `/login`. The expected behavior is either a clean
    // local-only path on the same origin, or a fallback to /dashboard —
    // never a redirect to a foreign origin and never a header-injection
    // payload reflected into the Location header.
    it.each([
      // Protocol-relative URL — must NOT exfiltrate to evil.com
      ['//evil.com', `https://${ROOT_DOMAIN}/dashboard`],
      // Backslash-prefixed authority — WHATWG normalizes `\` to `/` under
      // an HTTPS scheme, so `/\evil.com` parses to host=evil.com. Reject.
      ['/\\evil.com', `https://${ROOT_DOMAIN}/dashboard`],
      // Multiple leading backslashes — also an authority-switch attempt
      ['/\\\\evil.com', `https://${ROOT_DOMAIN}/dashboard`],
      // Backslash anywhere in the path — reject to be safe; legitimate
      // local paths never contain backslashes
      ['/admin\\users', `https://${ROOT_DOMAIN}/dashboard`],
      ['/admin\\evil.com', `https://${ROOT_DOMAIN}/dashboard`],
      [
        '/path\\with\\multiple\\backslashes',
        `https://${ROOT_DOMAIN}/dashboard`,
      ],
      // data: URI scheme — must be rejected
      [
        'data:text/html,<script>alert(1)</script>',
        `https://${ROOT_DOMAIN}/dashboard`,
      ],
      // javascript: URI scheme — must be rejected
      ['javascript:void(0)', `https://${ROOT_DOMAIN}/dashboard`],
      // Absolute http(s) URL — must be rejected
      ['https://evil.com/path', `https://${ROOT_DOMAIN}/dashboard`],
      // ASCII tab between leading `/` and `/evil.com` — WHATWG strips the
      // tab, making the parser see `//evil.com` and switch authority to
      // evil.com. The defense-in-depth host check catches this.
      ['/\t/evil.com', `https://${ROOT_DOMAIN}/dashboard`],
      ['/\n/evil.com', `https://${ROOT_DOMAIN}/dashboard`],
      ['/\r/evil.com', `https://${ROOT_DOMAIN}/dashboard`],
    ])('sanitizes malicious redirect param %s to safe target %s', async (rawRedirect, expectedLocation) => {
      vi.mocked(updateSession).mockResolvedValueOnce({
        supabaseResponse: NextResponse.next(),
        user: AUTHENTICATED_USER,
      });

      const req = new NextRequest(
        `https://${ROOT_DOMAIN}/login?redirect=${encodeURIComponent(rawRedirect)}`
      );
      req.headers.set('host', ROOT_DOMAIN);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(307);
      expect(location).toBe(expectedLocation);
    });

    it('never reflects CRLF header-injection payloads into the Location header', async () => {
      vi.mocked(updateSession).mockResolvedValueOnce({
        supabaseResponse: NextResponse.next(),
        user: AUTHENTICATED_USER,
      });

      // A raw CRLF + bogus header in the redirect param. The redirect target
      // must (a) stay on the same origin and (b) emit a Location value with
      // no embedded CR/LF characters, since reflecting either into the
      // response would smuggle a forged response header.
      const req = new NextRequest(
        `https://${ROOT_DOMAIN}/login?redirect=${encodeURIComponent('/admin\r\nx-test:1')}`
      );
      req.headers.set('host', ROOT_DOMAIN);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(307);
      expect(location).toBeTruthy();
      const parsed = new URL(location ?? '');
      expect(parsed.origin).toBe(`https://${ROOT_DOMAIN}`);
      expect(location ?? '').not.toContain('\r');
      expect(location ?? '').not.toContain('\n');
    });
  });

  it('should not rewrite API routes on subdomains (pass-through)', async () => {
    const req = new NextRequest(
      `https://ogabassey.${ROOT_DOMAIN}/api/storefront/products`
    );
    req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

    const res = await proxy(req);

    // If it was rewritten, the response would typically imply a rewrite in Next.js internals
    // But since we returned NextResponse.next(), it's a pass-through.
    // We verify that we got a valid response with security headers.
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');

    // Verify it didn't redirect (which would happen if /api was in MAIN_APP_ROUTES)
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(308);
  });

  it('passes PostHog relay requests through on merchant subdomains', async () => {
    const req = new NextRequest(
      `https://ogabassey.${ROOT_DOMAIN}/baci-relay/e/capture/`
    );
    req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('passes PostHog relay requests through on custom domains', async () => {
    const req = new NextRequest('https://ogabassey.com/baci-relay/e/capture/');
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(getSlugForCustomDomain).not.toHaveBeenCalled();
  });

  it('strips app credentials from PostHog relay requests', async () => {
    const req = new NextRequest(
      `https://ogabassey.${ROOT_DOMAIN}/baci-relay/e/capture/`
    );
    req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);
    req.headers.set('user-agent', 'PostHog Test Agent');
    req.headers.set('cookie', 'sb-auth-token=secret');
    req.headers.set('authorization', 'Bearer secret');
    req.headers.set('proxy-authorization', 'Bearer proxy-secret');
    req.headers.set(
      'referer',
      `https://ogabassey.${ROOT_DOMAIN}/checkout?email=buyer@example.com`
    );
    req.headers.set('x-csrf-token', 'csrf-secret');
    req.headers.set('x-supabase-auth-token', 'supabase-secret');

    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-request-cookie')).toBeNull();
    expect(res.headers.get('x-middleware-request-authorization')).toBeNull();
    expect(
      res.headers.get('x-middleware-request-proxy-authorization')
    ).toBeNull();
    expect(res.headers.get('x-middleware-request-referer')).toBeNull();
    expect(res.headers.get('x-middleware-request-x-csrf-token')).toBeNull();
    expect(
      res.headers.get('x-middleware-request-x-supabase-auth-token')
    ).toBeNull();
    expect(res.headers.get('x-middleware-request-user-agent')).toBe(
      'PostHog Test Agent'
    );
  });

  it('matches PostHog relay static assets so rewrites cannot bypass header stripping', () => {
    expect(config.matcher).toContain('/baci-relay/:path*');
  });

  it('does not match every static chunk for custom relay assets', () => {
    const legacyCatchAllMatcher = '/((?:.+/)?(?:static|array)/.*)';
    const customRelayStaticMatcher = config.matcher.find((matcher) =>
      matcher?.includes('(?:static|array)')
    );
    if (!customRelayStaticMatcher) {
      throw new Error('Custom relay static matcher is missing');
    }

    const regex = new RegExp(`^${customRelayStaticMatcher}`);
    const matchesNextStaticChunk = regex.test('/_next/static/chunks/app.js');
    const matchesCustomRelayAsset = regex.test(
      '/baci-observe/static/recorder.js'
    );

    expect(config.matcher).not.toContain(legacyCatchAllMatcher);
    expect(matchesNextStaticChunk).toBe(false);
    expect(matchesCustomRelayAsset).toBe(true);
  });

  it('strips app credentials from custom PostHog relay static asset paths', async () => {
    const originalRelayPath = process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH;
    process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH = '/baci-observe';

    try {
      vi.resetModules();
      const { config: configWithCustomRelay, proxy: proxyWithCustomRelay } =
        await import('./proxy');

      expect(configWithCustomRelay.matcher).toContain(
        '/((?!_next/static(?:/|$))(?:.+/)?(?:static|array)/.*)'
      );

      const req = new NextRequest(
        `https://ogabassey.${ROOT_DOMAIN}/baci-observe/static/recorder.js`
      );
      req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);
      req.headers.set('cookie', 'sb-auth-token=secret');
      req.headers.set('authorization', 'Bearer secret');
      req.headers.set(
        'referer',
        `https://ogabassey.${ROOT_DOMAIN}/checkout?email=buyer@example.com`
      );

      const res = await proxyWithCustomRelay(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('x-middleware-request-cookie')).toBeNull();
      expect(res.headers.get('x-middleware-request-authorization')).toBeNull();
      expect(res.headers.get('x-middleware-request-referer')).toBeNull();
    } finally {
      if (originalRelayPath === undefined) {
        delete process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH;
      } else {
        process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH = originalRelayPath;
      }
      vi.resetModules();
    }
  });

  it('falls back to the default PostHog relay path for reserved route prefixes', async () => {
    const originalRelayPath = process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH;
    process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH = '/api';

    try {
      vi.resetModules();
      const { proxy: proxyWithReservedRelayPath } = await import('./proxy');

      const req = new NextRequest(`https://${ROOT_DOMAIN}/api/products`);
      req.headers.set('host', ROOT_DOMAIN);
      req.headers.set('user-agent', 'Reserved Relay Test Agent');

      const res = await proxyWithReservedRelayPath(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('x-middleware-request-user-agent')).toBeNull();
    } finally {
      if (originalRelayPath === undefined) {
        delete process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH;
      } else {
        process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH = originalRelayPath;
      }
      vi.resetModules();
    }
  });

  it('should rewrite storefront checkout routes on merchant subdomains', async () => {
    const req = new NextRequest(`https://ogabassey.${ROOT_DOMAIN}/checkout`);
    req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

    const res = await proxy(req);

    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      `https://ogabassey.${ROOT_DOMAIN}/ogabassey/checkout`
    );
    expect(res.headers.get('x-middleware-request-x-merchant-slug')).toBe(
      'ogabassey'
    );
  });

  describe('crawl-budget PDP hard-404 (PR-B §3.2)', () => {
    const resolutionMock = vi.mocked(resolveStorefrontProductSlugResolution);
    const mockMissing = (missing: boolean) =>
      resolutionMock.mockResolvedValue(
        missing ? { kind: 'missing' } : { kind: 'present-or-unknown' }
      );

    it('returns a hard 404 for a confirmed-missing product slug on a custom domain', async () => {
      mockMissing(true);
      const req = new NextRequest(
        'https://ogabassey.com/smartphones/totally-made-up'
      );
      req.headers.set('host', 'ogabassey.com');

      const res = await proxy(req);

      expect(res.status).toBe(404);
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
      expect(res.headers.get('Cache-Control')).toContain('no-store');
      expect(res.headers.get('Content-Type')).toContain('text/html');
      // Header-level noindex so HEAD / non-HTML-parsing crawlers still see it.
      expect(res.headers.get('X-Robots-Tag')).toContain('noindex');
      expect(resolutionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'ogabassey',
          productSlug: 'totally-made-up',
        })
      );
    });

    it('returns a header-only hard 404 (no body) for HEAD requests to confirmed-missing products', async () => {
      mockMissing(true);
      const req = new NextRequest(
        'https://ogabassey.com/smartphones/totally-made-up',
        { method: 'HEAD' }
      );
      req.headers.set('host', 'ogabassey.com');

      const res = await proxy(req);

      expect(res.status).toBe(404);
      // HEAD must not carry a body (RFC 9110); the noindex travels in the header.
      expect(await res.text()).toBe('');
      expect(res.headers.get('X-Robots-Tag')).toContain('noindex');
      expect(res.headers.get('Cache-Control')).toContain('no-store');
    });

    it('returns a real 308 for a redirectable archived product slug before the PDP route streams', async () => {
      resolutionMock.mockResolvedValue({
        kind: 'redirect',
        redirectPath: '/smartphones/iphone-15-pro-max',
      });
      const req = new NextRequest(
        'https://ogabassey.com/smartphones/iphone-15-pro-max-8gb-256gb'
      );
      req.headers.set('host', 'ogabassey.com');

      const res = await proxy(req);

      expect(res.status).toBe(308);
      expect(res.headers.get('location')).toBe(
        'https://ogabassey.com/smartphones/iphone-15-pro-max'
      );
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
      expect(resolutionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'ogabassey',
          productSlug: 'iphone-15-pro-max-8gb-256gb',
        })
      );
    });

    it('preserves attribution query params when redirecting a legacy product alias', async () => {
      resolutionMock.mockResolvedValue({
        kind: 'redirect',
        redirectPath: '/smartphones/iphone-15-pro-max',
      });
      const req = new NextRequest(
        'https://ogabassey.com/smartphones/iphone-15-pro-max-8gb-256gb?utm_source=email&gclid=abc123'
      );
      req.headers.set('host', 'ogabassey.com');

      const res = await proxy(req);

      expect(res.status).toBe(308);
      expect(res.headers.get('location')).toBe(
        'https://ogabassey.com/smartphones/iphone-15-pro-max?utm_source=email&gclid=abc123'
      );
    });

    it('does not hard-404 query-param product URLs even when the slug is reported missing', async () => {
      mockMissing(true);
      const req = new NextRequest(
        'https://ogabassey.com/smartphones/totally-made-up?utm_source=email'
      );
      req.headers.set('host', 'ogabassey.com');

      const res = await proxy(req);

      expect(res.status).not.toBe(404);
    });

    it('falls through (rewrite, not 404) when the product slug exists', async () => {
      mockMissing(false);
      const req = new NextRequest(
        'https://ogabassey.com/smartphones/iphone-15'
      );
      req.headers.set('host', 'ogabassey.com');

      const res = await proxy(req);

      expect(res.status).not.toBe(404);
      expect(res.headers.get('x-middleware-rewrite')).toContain(
        '/ogabassey.com/smartphones/iphone-15'
      );
    });

    it('does not run the check for RSC/prefetch navigations', async () => {
      mockMissing(true);
      const req = new NextRequest(
        'https://ogabassey.com/smartphones/totally-made-up'
      );
      req.headers.set('host', 'ogabassey.com');
      req.headers.set('RSC', '1');

      const res = await proxy(req);

      expect(res.status).not.toBe(404);
      expect(resolutionMock).not.toHaveBeenCalled();
    });

    it.each([
      ['blog', 'https://ogabassey.com/blog/my-post'],
      ['account', 'https://ogabassey.com/account/login'],
      ['pages', 'https://ogabassey.com/pages/rewards'],
    ])('does not hard-404 reserved first-segment route /%s/... (real App Router page)', async (_segment, url) => {
      mockMissing(true);
      const req = new NextRequest(url);
      req.headers.set('host', 'ogabassey.com');

      const res = await proxy(req);

      expect(res.status).not.toBe(404);
      expect(resolutionMock).not.toHaveBeenCalled();
    });

    it('hard-404s a confirmed-missing categoryless /products/{slug} PDP (getProductUrl fallback)', async () => {
      mockMissing(true);
      const req = new NextRequest('https://ogabassey.com/products/not-real');
      req.headers.set('host', 'ogabassey.com');

      const res = await proxy(req);

      expect(res.status).toBe(404);
      expect(resolutionMock).toHaveBeenCalledWith(
        expect.objectContaining({ productSlug: 'not-real' })
      );
    });

    it('does not hard-404 an existing /products/{slug} PDP', async () => {
      mockMissing(false);
      const req = new NextRequest('https://ogabassey.com/products/iphone-15');
      req.headers.set('host', 'ogabassey.com');

      const res = await proxy(req);

      expect(res.status).not.toBe(404);
    });

    it('does not hard-404 the singular /product/{slug} legacy redirect route', async () => {
      mockMissing(true);
      const req = new NextRequest('https://ogabassey.com/product/whatever');
      req.headers.set('host', 'ogabassey.com');

      const res = await proxy(req);

      expect(res.status).not.toBe(404);
      expect(resolutionMock).not.toHaveBeenCalled();
    });

    it('does not hard-404 a UUID product URL (resolved by the page id lookup)', async () => {
      mockMissing(true);
      const req = new NextRequest(
        'https://ogabassey.com/smartphones/6b5cb8a4-5575-456c-b936-8cdfae30db74'
      );
      req.headers.set('host', 'ogabassey.com');

      const res = await proxy(req);

      expect(res.status).not.toBe(404);
      expect(resolutionMock).not.toHaveBeenCalled();
    });

    it('does not hard-404 the /my-account/[...path] catch-all (non-PDP first segment)', async () => {
      mockMissing(true);
      const req = new NextRequest('https://ogabassey.com/my-account/orders');
      req.headers.set('host', 'ogabassey.com');

      const res = await proxy(req);

      expect(res.status).not.toBe(404);
      expect(resolutionMock).not.toHaveBeenCalled();
    });

    it('decodes a percent-encoded product slug before the membership check', async () => {
      mockMissing(false);
      // `cafe%cc%81` is `cafe` + a combining acute accent — the DB slug stores
      // the decoded form, so the proxy must compare decoded, not the raw bytes.
      const req = new NextRequest(
        'https://ogabassey.com/smartphones/cafe%cc%81'
      );
      req.headers.set('host', 'ogabassey.com');

      await proxy(req);

      expect(resolutionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          productSlug: decodeURIComponent('cafe%cc%81'),
        })
      );
    });

    it('returns a hard 404 for a confirmed-missing product slug on a subdomain', async () => {
      mockMissing(true);
      const req = new NextRequest(
        'https://ogabassey.usebaci.com/smartphones/totally-made-up'
      );
      req.headers.set('host', 'ogabassey.usebaci.com');

      const res = await proxy(req);

      expect(res.status).toBe(404);
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
      expect(resolutionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'ogabassey',
          productSlug: 'totally-made-up',
        })
      );
    });

    it('returns a hard 404 for a confirmed-missing slug on a root-domain slug path', async () => {
      // getCustomDomainForSlug defaults to null, so the slug is served in
      // path-mode (no 301 to a custom domain) and the platform host strips the
      // leading slug, leaving `{category}/{product}` for the check.
      mockMissing(true);
      const req = new NextRequest(
        'https://usebaci.com/ogabassey/smartphones/totally-made-up'
      );
      req.headers.set('host', 'usebaci.com');

      const res = await proxy(req);

      expect(res.status).toBe(404);
      expect(resolutionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'ogabassey',
          productSlug: 'totally-made-up',
        })
      );
    });

    it('keeps the storefront slug prefix when redirecting a legacy product alias on the root domain', async () => {
      resolutionMock.mockResolvedValue({
        kind: 'redirect',
        redirectPath: '/smartphones/iphone-15-pro-max',
      });
      const req = new NextRequest(
        'https://usebaci.com/ogabassey/smartphones/iphone-15-pro-max-8gb-256gb?utm_source=email'
      );
      req.headers.set('host', 'usebaci.com');

      const res = await proxy(req);

      expect(res.status).toBe(308);
      expect(res.headers.get('location')).toBe(
        'https://usebaci.com/ogabassey/smartphones/iphone-15-pro-max?utm_source=email'
      );
      expect(resolutionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'ogabassey',
          productSlug: 'iphone-15-pro-max-8gb-256gb',
        })
      );
    });

    it('exempts an AUTHENTICATED internal slug-set call from the public rate limiter', async () => {
      const req = new NextRequest(
        'https://ogabassey.com/api/internal/slug-set/ogabassey.com?slug=x'
      );
      req.headers.set('host', 'ogabassey.com');
      req.headers.set('Authorization', 'Bearer test-internal-secret');

      await proxy(req);

      expect(checkRateLimit).not.toHaveBeenCalled();
    });

    it('still rate-limits an UNAUTHENTICATED request to the internal route (anti-flood)', async () => {
      const req = new NextRequest(
        'https://ogabassey.com/api/internal/slug-set/ogabassey.com'
      );
      req.headers.set('host', 'ogabassey.com');

      await proxy(req);

      // No valid bearer → must NOT be exempt, or the secret could be
      // flood-guessed without ever tripping the limiter.
      expect(checkRateLimit).toHaveBeenCalled();
    });

    it('still rate-limits an internal request bearing the WRONG secret', async () => {
      const req = new NextRequest(
        'https://ogabassey.com/api/internal/slug-set/ogabassey.com'
      );
      req.headers.set('host', 'ogabassey.com');
      req.headers.set('Authorization', 'Bearer wrong-secret');

      await proxy(req);

      expect(checkRateLimit).toHaveBeenCalled();
    });
  });

  it('does not treat root checkout as a merchant slug redirect candidate', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/checkout`);
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);

    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(getCustomDomainForSlug).not.toHaveBeenCalled();
  });

  it.each([
    '/wc-api/klp_wc_payment_webhook',
    '/wc-api/klp_wc_payment_webhook/',
  ])('rewrites legacy Klump WooCommerce webhook path %s to the Klump API handler', async (path) => {
    const req = new NextRequest(`https://ogabassey.com${path}?source=klump`, {
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).not.toBe(301);
    expect(res.status).not.toBe(308);
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(getSlugForCustomDomain).not.toHaveBeenCalled();
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://ogabassey.com/api/payments/klump/webhook?source=klump'
    );
    expect(res.headers.get('x-pathname')).toBe('/api/payments/klump/webhook');
  });

  it('does not block legacy Klump payment webhooks with an external Origin header', async () => {
    const getSlugForCustomDomainMock = vi.mocked(getSlugForCustomDomain);
    getSlugForCustomDomainMock.mockResolvedValue(null);
    const req = new NextRequest(
      'https://ogabassey.com/wc-api/klp_wc_payment_webhook/',
      {
        body: '{}',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://checkout.useklump.com',
        },
        method: 'POST',
      }
    );
    req.headers.set('host', 'ogabassey.com');

    try {
      const res = await proxy(req);

      expect(res.status).not.toBe(403);
      expect(getSlugForCustomDomain).not.toHaveBeenCalled();
      expect(res.headers.get('x-middleware-rewrite')).toBe(
        'https://ogabassey.com/api/payments/klump/webhook'
      );
    } finally {
      getSlugForCustomDomainMock.mockResolvedValue('ogabassey');
    }
  });

  it('does not block direct payment webhook API routes with an external Origin header', async () => {
    const getSlugForCustomDomainMock = vi.mocked(getSlugForCustomDomain);
    getSlugForCustomDomainMock.mockResolvedValue(null);
    const req = new NextRequest(
      `https://${ROOT_DOMAIN}/api/payments/klump/webhook`,
      {
        body: '{}',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://checkout.useklump.com',
        },
        method: 'POST',
      }
    );
    req.headers.set('host', ROOT_DOMAIN);

    try {
      const res = await proxy(req);

      expect(res.status).toBe(200);
      expect(getSlugForCustomDomain).not.toHaveBeenCalled();
      expect(res.headers.get('x-pathname')).toBe('/api/payments/klump/webhook');
    } finally {
      getSlugForCustomDomainMock.mockResolvedValue('ogabassey');
    }
  });

  it('preserves no-trailing-slash redirects for ordinary storefront paths', async () => {
    const req = new NextRequest('https://ogabassey.com/products/');
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://ogabassey.com/products');
  });

  it('preserves no-trailing-slash redirects for storefront paths with dots in slugs', async () => {
    const req = new NextRequest('https://ogabassey.com/products/iphone-v1.0/');
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/products/iphone-v1.0'
    );
  });

  it('should fall back to domain when slug lookup returns null', async () => {
    vi.mocked(getSlugForCustomDomain).mockResolvedValueOnce(null);
    const req = new NextRequest(
      'https://unknown-merchant.com/blog/sitemap.xml'
    );
    req.headers.set('host', 'unknown-merchant.com');

    const res = await proxy(req);

    expect(getSlugForCustomDomain).toHaveBeenCalledWith('unknown-merchant.com');
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://unknown-merchant.com/unknown-merchant.com/blog/sitemap.xml'
    );
  });

  it('should rewrite custom-domain blog sitemaps with the merchant slug', async () => {
    const req = new NextRequest('https://ogabassey.com/blog/sitemap.xml');
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(getSlugForCustomDomain).toHaveBeenCalledWith('ogabassey.com');
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://ogabassey.com/ogabassey/blog/sitemap.xml'
    );
  });

  it('rewrites custom-domain root sitemaps to the explicit root sitemap route', async () => {
    const req = new NextRequest('https://ogabassey.com/sitemap.xml');
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(getSlugForCustomDomain).toHaveBeenCalledWith('ogabassey.com');
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://ogabassey.com/ogabassey/sitemap/root.xml'
    );
    expect(res.headers.get('x-middleware-request-x-merchant-domain')).toBe(
      'ogabassey.com'
    );
    expect(res.headers.get('x-middleware-request-x-merchant-slug')).toBe(
      'ogabassey'
    );
  });

  it('rewrites subdomain root sitemaps to the explicit root sitemap route', async () => {
    const req = new NextRequest(`https://ogabassey.${ROOT_DOMAIN}/sitemap.xml`);
    req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

    const res = await proxy(req);

    expect(res.headers.get('x-middleware-rewrite')).toBe(
      `https://ogabassey.${ROOT_DOMAIN}/ogabassey/sitemap/root.xml`
    );
    expect(res.headers.get('x-middleware-request-x-merchant-slug')).toBe(
      'ogabassey'
    );
  });

  it('rewrites custom-domain favicon.ico requests to the dynamic favicon route', async () => {
    const req = new NextRequest('https://ogabassey.com/favicon.ico');
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(getSlugForCustomDomain).toHaveBeenCalledWith('ogabassey.com');
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://ogabassey.com/ogabassey/favicon.ico'
    );
    expect(res.headers.get('x-middleware-request-x-merchant-domain')).toBe(
      'ogabassey.com'
    );
    expect(res.headers.get('x-middleware-request-x-merchant-slug')).toBe(
      'ogabassey'
    );
  });

  it('rewrites subdomain favicon.ico requests to the dynamic favicon route without custom domain redirect', async () => {
    const req = new NextRequest(`https://ogabassey.${ROOT_DOMAIN}/favicon.ico`);
    req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

    const res = await proxy(req);

    expect(res.headers.get('x-middleware-rewrite')).toBe(
      `https://ogabassey.${ROOT_DOMAIN}/ogabassey/favicon.ico`
    );
    expect(res.headers.get('x-middleware-request-x-merchant-slug')).toBe(
      'ogabassey'
    );
    expect(res.status).not.toBe(301);
  });

  it('passes through platform root favicon.ico requests unmodified', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/favicon.ico`);
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);

    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('passes custom-domain IndexNow key files through to the public key file', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/0751d5c882ab3d7c013ecbfe9e624d71.txt'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(getSlugForCustomDomain).toHaveBeenCalledWith('ogabassey.com');
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.headers.get('x-middleware-request-x-custom-domain')).toBe(
      'ogabassey.com'
    );
    expect(res.headers.get('x-middleware-request-x-merchant-domain')).toBe(
      'ogabassey.com'
    );
    expect(res.headers.get('x-middleware-request-x-merchant-slug')).toBe(
      'ogabassey'
    );
  });

  it('does not pass through IndexNow key files for unregistered custom domains', async () => {
    vi.mocked(getSlugForCustomDomain).mockResolvedValueOnce(null);
    const req = new NextRequest(
      'https://unregistered.example/0751d5c882ab3d7c013ecbfe9e624d71.txt'
    );
    req.headers.set('host', 'unregistered.example');

    const res = await proxy(req);

    expect(getSlugForCustomDomain).toHaveBeenCalledWith('unregistered.example');
    expect(res.headers.get('x-middleware-next')).toBeNull();
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://unregistered.example/unregistered.example/0751d5c882ab3d7c013ecbfe9e624d71.txt'
    );
  });

  it('keeps normal custom-domain browsers in the streaming metadata bucket', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/smartphones/samsung-galaxy-a37-5g'
    );
    req.headers.set('host', 'ogabassey.com');
    req.headers.set(
      'user-agent',
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36'
    );

    const res = await proxy(req);

    const rewriteUrl = new URL(
      res.headers.get('x-middleware-rewrite') as string
    );
    expect(rewriteUrl.origin).toBe('https://ogabassey.com');
    expect(rewriteUrl.pathname).toBe(
      '/ogabassey.com/smartphones/samsung-galaxy-a37-5g'
    );
    expect(
      rewriteUrl.searchParams.get(STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM)
    ).toBe('streaming');
    expect(
      res.headers.get('x-middleware-request-x-baci-metadata-cache-bucket')
    ).toBe('streaming');
    expect(res.headers.get('Vary')).toBe('x-baci-metadata-cache-bucket');
  });

  it('separates empty user-agent streamed shells from browser metadata buckets', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/smartphones/samsung-galaxy-a37-5g'
    );
    req.headers.set('host', 'ogabassey.com');
    req.headers.set('user-agent', '');

    const res = await proxy(req);
    const rewriteUrl = new URL(
      res.headers.get('x-middleware-rewrite') as string
    );

    expect(
      res.headers.get('x-middleware-request-x-baci-metadata-cache-bucket')
    ).toBe('streaming');
    expect(
      rewriteUrl.searchParams.get(STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM)
    ).toBe('streaming');
  });

  it('overwrites spoofed metadata cache buckets for metadata-blocking bots', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/smartphones/samsung-galaxy-a37-5g'
    );
    req.headers.set('host', 'ogabassey.com');
    req.headers.set('user-agent', 'Twitterbot/1.0');
    req.headers.set('x-baci-metadata-cache-bucket', 'streaming');

    const res = await proxy(req);
    const rewriteUrl = new URL(
      res.headers.get('x-middleware-rewrite') as string
    );

    expect(
      res.headers.get('x-middleware-request-x-baci-metadata-cache-bucket')
    ).toBe('metadata-blocking');
    expect(
      rewriteUrl.searchParams.get(STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM)
    ).toBe('metadata-blocking');
    expect(res.headers.get('Vary')).toBe('x-baci-metadata-cache-bucket');
  });

  it('puts Next PPR DOM bots in the metadata-blocking cache bucket', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/smartphones/samsung-galaxy-a37-5g'
    );
    req.headers.set('host', 'ogabassey.com');
    req.headers.set('user-agent', 'Googlebot/2.1');

    const res = await proxy(req);

    expect(
      res.headers.get('x-middleware-request-x-baci-metadata-cache-bucket')
    ).toBe('metadata-blocking');
    expect(res.headers.get('Vary')).toBe('x-baci-metadata-cache-bucket');
  });

  it('applies streaming cache partitioning to merchant subdomain browsers', async () => {
    const req = new NextRequest(
      `https://ogabassey.${ROOT_DOMAIN}/smartphones/samsung-galaxy-a37-5g`
    );
    req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);
    req.headers.set(
      'user-agent',
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36'
    );

    const res = await proxy(req);
    const rewriteUrl = new URL(
      res.headers.get('x-middleware-rewrite') as string
    );

    expect(
      res.headers.get('x-middleware-request-x-baci-metadata-cache-bucket')
    ).toBe('streaming');
    expect(
      rewriteUrl.searchParams.get(STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM)
    ).toBe('streaming');
    expect(res.headers.get('Vary')).toBe('x-baci-metadata-cache-bucket');
  });

  it('applies hidden streaming cache partitioning to root-domain PDP browser routes', async () => {
    const req = new NextRequest(
      `https://${ROOT_DOMAIN}/merchant-demo/products/samsung-galaxy-a37-5g`
    );
    req.headers.set('host', ROOT_DOMAIN);
    req.headers.set(
      'user-agent',
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36'
    );

    const res = await proxy(req);
    const rewriteUrl = new URL(
      res.headers.get('x-middleware-rewrite') as string
    );

    expect(rewriteUrl.origin).toBe(`https://${ROOT_DOMAIN}`);
    expect(rewriteUrl.pathname).toBe(
      '/merchant-demo/products/samsung-galaxy-a37-5g'
    );
    expect(
      rewriteUrl.searchParams.get(STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM)
    ).toBe('streaming');
    expect(
      res.headers.get('x-middleware-request-x-baci-metadata-cache-bucket')
    ).toBe('streaming');
    expect(res.headers.get('Vary')).toBe('x-baci-metadata-cache-bucket');
  });

  it.each([
    ['terms-and-conditions', '/terms-and-conditions'],
    ['terms-of-service', '/terms-of-service'],
  ])('redirects custom-domain legacy %s URLs to the canonical /terms page before storefront rewrite', async (_label, legacyPathname) => {
    const req = new NextRequest(
      `https://ogabassey.com${legacyPathname}?utm_source=email`
    );
    req.headers.set('host', 'ogabassey.com');
    req.headers.set('user-agent', 'Googlebot/2.1');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/terms?utm_source=email'
    );
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('redirects custom-domain legacy terms aliases for HEAD requests', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/terms-and-conditions?utm_source=email',
      { method: 'HEAD' }
    );
    req.headers.set('host', 'ogabassey.com');
    req.headers.set('user-agent', 'Googlebot/2.1');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/terms?utm_source=email'
    );
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('does not 301 non-idempotent legacy terms alias requests', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/terms-and-conditions?utm_source=email',
      { method: 'POST' }
    );
    req.headers.set('host', 'ogabassey.com');
    req.headers.set('user-agent', 'Googlebot/2.1');

    const res = await proxy(req);

    expect(res.status).not.toBe(301);
    expect(res.headers.get('location')).toBeNull();
  });

  it('does not redirect the canonical custom-domain /terms URL to itself', async () => {
    const req = new NextRequest('https://ogabassey.com/terms?utm_source=email');
    req.headers.set('host', 'ogabassey.com');
    req.headers.set('user-agent', 'Googlebot/2.1');

    const res = await proxy(req);
    const rewriteUrl = new URL(
      res.headers.get('x-middleware-rewrite') as string
    );

    expect(res.status).not.toBe(301);
    expect(res.headers.get('location')).toBeNull();
    expect(rewriteUrl.pathname).toBe('/ogabassey.com/terms');
    expect(
      rewriteUrl.searchParams.get(STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM)
    ).toBe('metadata-blocking');
  });

  it('redirects merchant subdomain legacy terms aliases to /terms without adding a slug-prefixed duplicate', async () => {
    const req = new NextRequest(
      `https://merchant-demo.${ROOT_DOMAIN}/terms-and-conditions?ref=legal`
    );
    req.headers.set('host', `merchant-demo.${ROOT_DOMAIN}`);
    req.headers.set('user-agent', 'Googlebot/2.1');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      `https://merchant-demo.${ROOT_DOMAIN}/terms?ref=legal`
    );
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('collapses custom-domain slug-prefixed legacy terms aliases directly to /terms', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/ogabassey/terms-and-conditions?utm_source=email'
    );
    req.headers.set('host', 'ogabassey.com');
    req.headers.set('user-agent', 'Googlebot/2.1');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/terms?utm_source=email'
    );
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('collapses root-domain slug-prefixed legacy terms aliases to one custom-domain canonical hop', async () => {
    vi.mocked(getCustomDomainForSlug).mockResolvedValueOnce('ogabassey.com');
    const req = new NextRequest(
      `https://${ROOT_DOMAIN}/ogabassey/terms-and-conditions?utm_source=email`
    );
    req.headers.set('host', ROOT_DOMAIN);
    req.headers.set('user-agent', 'Googlebot/2.1');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/terms?utm_source=email'
    );
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it.each([
    [
      'custom-domain storefront home',
      'https://ogabassey.com/',
      '/ogabassey.com',
      'metadata-blocking',
      'Googlebot/2.1',
    ],
    [
      'custom-domain products index',
      'https://ogabassey.com/products',
      '/ogabassey.com/products',
      'metadata-blocking',
      'Googlebot/2.1',
    ],
    [
      'custom-domain category listing',
      'https://ogabassey.com/gaming-laptops',
      '/ogabassey.com/gaming-laptops',
      'metadata-blocking',
      'Googlebot/2.1',
    ],
    [
      'custom-domain blog post',
      'https://ogabassey.com/blog/the-ultimate-checklist-for-buying-a-used-iphone-in-2025',
      '/ogabassey.com/blog/the-ultimate-checklist-for-buying-a-used-iphone-in-2025',
      'metadata-blocking',
      'Googlebot/2.1',
    ],
    [
      'subdomain category listing',
      `https://ogabassey.${ROOT_DOMAIN}/gaming-laptops`,
      '/ogabassey/gaming-laptops',
      'streaming',
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
    ],
    [
      'subdomain storefront home',
      `https://ogabassey.${ROOT_DOMAIN}/`,
      '/ogabassey',
      'streaming',
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
    ],
    [
      'root-domain slug-prefixed category listing',
      `https://${ROOT_DOMAIN}/merchant-demo/gaming-laptops`,
      '/merchant-demo/gaming-laptops',
      'streaming',
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
    ],
    [
      'root-domain slug-prefixed storefront home',
      `https://${ROOT_DOMAIN}/merchant-demo`,
      '/merchant-demo',
      'streaming',
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
    ],
    [
      'root-domain slug-prefixed blog post',
      `https://${ROOT_DOMAIN}/merchant-demo/blog/the-ultimate-checklist-for-buying-a-used-iphone-in-2025`,
      '/merchant-demo/blog/the-ultimate-checklist-for-buying-a-used-iphone-in-2025',
      'streaming',
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
    ],
  ])('applies hidden metadata cache partitioning to public %s', async (_label, url, expectedPathname, expectedBucket, userAgent) => {
    const req = new NextRequest(url);
    req.headers.set('host', new URL(url).host);
    req.headers.set('user-agent', userAgent);

    const res = await proxy(req);
    expect(res.headers.get('x-middleware-rewrite')).not.toBeNull();
    const rewriteUrl = new URL(
      res.headers.get('x-middleware-rewrite') as string
    );

    expect(rewriteUrl.pathname).toBe(expectedPathname);
    expect(
      rewriteUrl.searchParams.get(STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM)
    ).toBe(expectedBucket);
    expect(
      res.headers.get('x-middleware-request-x-baci-metadata-cache-bucket')
    ).toBe(expectedBucket);
    expect(res.headers.get('Vary')).toBe('x-baci-metadata-cache-bucket');
  });

  it.each([
    `https://${ROOT_DOMAIN}/pricing`,
    `https://${ROOT_DOMAIN}/checkout`,
    `https://${ROOT_DOMAIN}/blog`,
    `https://${ROOT_DOMAIN}/terms`,
  ])('does not add storefront metadata cache partitioning to platform route %s', async (url) => {
    const req = new NextRequest(url);
    req.headers.set('host', new URL(url).host);
    req.headers.set('user-agent', 'Googlebot/2.1');

    const res = await proxy(req);

    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it.each([
    'https://ogabassey.com/smartphones/samsung-galaxy-z-fold-4',
    `https://ogabassey.${ROOT_DOMAIN}/smartphones/samsung-galaxy-z-fold-4`,
    `https://${ROOT_DOMAIN}/ogabassey/smartphones/samsung-galaxy-z-fold-4`,
  ])('CDN-caches the canonical public PDP shell for %s', async (url) => {
    const req = new NextRequest(url);
    req.headers.set('host', new URL(url).host);

    const res = await proxy(req);

    // The Next resume-mismatch that previously required no-store on PDP HTML is
    // fixed via patches/next@16.2.9.patch (PR #2436), so the prerendered PDP
    // shell is safe to cache/replay at the edge for the LCP win.
    expect(res.headers.get('Cache-Control')).toBe(
      's-maxage=300, stale-while-revalidate=3600'
    );
  });

  it.each([
    // Per-user / authenticated route groups must NEVER be edge-cached.
    'https://ogabassey.com/account/orders',
    'https://ogabassey.com/my-account/profile',
    'https://ogabassey.com/receipts/abc-123',
    'https://ogabassey.com/order-success/abc-123',
    'https://ogabassey.com/checkout/success',
    'https://ogabassey.com/cart/review',
    // Reserved fallback PDP shape stays no-store (uncategorized product path).
    'https://ogabassey.com/products/samsung-galaxy-z-fold-4',
    // Singular legacy redirect-only route must stay no-store.
    'https://ogabassey.com/product/samsung-galaxy-z-fold-4',
    // Param / non-canonical PDP URLs (e.g. invalid variant streams a redirect)
    // must not be cached as a non-canonical shell.
    'https://ogabassey.com/smartphones/samsung-galaxy-z-fold-4?storage=128GB',
    'https://ogabassey.com/smartphones/samsung-galaxy-z-fold-4?variantId=x',
    // Single-segment home/catalog shells stay no-store.
    'https://ogabassey.com/steam-deck',
  ])('keeps non-public / non-canonical storefront documents out of the CDN cache for %s', async (url) => {
    const req = new NextRequest(url);
    req.headers.set('host', new URL(url).host);

    const res = await proxy(req);

    expect(res.headers.get('Cache-Control')).toBe(
      'no-cache, no-store, max-age=0, must-revalidate'
    );
  });

  it.each([
    'https://ogabassey.com/smartphones/best-under/under-500k',
    'https://ogabassey.com/smartphones/compare/iphone-15-vs-samsung-s24',
    `https://${ROOT_DOMAIN}/ogabassey/smartphones/best-under/under-500k`,
    `https://${ROOT_DOMAIN}/ogabassey/smartphones/compare/iphone-15-vs-samsung-s24`,
  ])('keeps SEO listing subroutes cacheable for %s', async (url) => {
    const req = new NextRequest(url);
    req.headers.set('host', new URL(url).host);

    const res = await proxy(req);

    expect(res.headers.get('Cache-Control')).toBe(
      's-maxage=300, stale-while-revalidate=3600'
    );
  });

  it.each([
    `https://${ROOT_DOMAIN}/dashboard/analytics/compare/monthly`,
    `https://${ROOT_DOMAIN}/dashboard/settings/profile`,
    `https://${ROOT_DOMAIN}/api/products/123`,
  ])('does not apply storefront CDN caching to app routes for %s', async (url) => {
    const req = new NextRequest(url);
    req.headers.set('host', new URL(url).host);

    const res = await proxy(req);

    expect(res.headers.get('Cache-Control')).toBe(
      'no-cache, must-revalidate, max-age=0'
    );
  });

  it.each(
    MACHINE_READABLE_TEST_PATHS
  )('passes custom-domain machine-readable path %s to the app route', async (path) => {
    const req = new NextRequest(`https://ogabassey.com${path}`);
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(getSlugForCustomDomain).toHaveBeenCalledWith('ogabassey.com');
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.headers.get('x-middleware-request-x-custom-domain')).toBe(
      'ogabassey.com'
    );
    expect(res.headers.get('x-middleware-request-x-merchant-domain')).toBe(
      'ogabassey.com'
    );
  });

  it.each(
    MACHINE_READABLE_TEST_PATHS
  )('passes platform machine-readable path %s to the app route', async (path) => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}${path}`);
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);

    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('strips spoofed merchant slug headers from unresolved custom-domain machine-readable requests', async () => {
    vi.mocked(getSlugForCustomDomain).mockResolvedValueOnce(null);
    const req = new NextRequest('https://unknown.example/agent-trust.json');
    req.headers.set('host', 'unknown.example');
    req.headers.set('x-merchant-slug', 'target-store');

    const res = await proxy(req);

    expect(getSlugForCustomDomain).toHaveBeenCalledWith('unknown.example');
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.headers.get('x-middleware-request-x-merchant-slug')).toBeNull();
    expect(res.headers.get('x-middleware-request-x-custom-domain')).toBe(
      'unknown.example'
    );
    expect(res.headers.get('x-middleware-request-x-merchant-domain')).toBe(
      'unknown.example'
    );
  });

  it.each([
    '/auth.md',
    '/openapi.json',
    '/agent-commerce.json',
    '/agent-trust.json',
    '/.well-known/acp.json',
    '/.well-known/agent-native-commerce',
    '/.well-known/agent-skills/index.json',
    '/.well-known/agent-skills/baci-storefront/SKILL.md',
    '/.well-known/api-catalog',
    '/.well-known/mcp/server-card.json',
    '/.well-known/ucp',
    '/feeds/google-merchant.xml',
    '/feeds/openai.jsonl',
    '/feeds/agent-products.jsonl',
  ])('does not canonicalize custom-domain machine-readable path %s when the merchant slug is feeds', async (path) => {
    vi.mocked(getSlugForCustomDomain).mockResolvedValueOnce('feeds');
    const req = new NextRequest(`https://shop.example${path}`);
    req.headers.set('host', 'shop.example');

    const res = await proxy(req);

    expect(getSlugForCustomDomain).toHaveBeenCalledWith('shop.example');
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.headers.get('x-middleware-request-x-merchant-slug')).toBe(
      'feeds'
    );
  });

  it('strips spoofed custom-domain headers from subdomain machine-readable requests', async () => {
    const req = new NextRequest(
      `https://ogabassey.${ROOT_DOMAIN}/agent-trust.json`
    );
    req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);
    req.headers.set('x-custom-domain', 'target-store.example');
    req.headers.set('x-merchant-domain', 'target-store.example');

    const res = await proxy(req);

    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.headers.get('x-middleware-request-x-merchant-slug')).toBe(
      'ogabassey'
    );
    expect(res.headers.get('x-middleware-request-x-custom-domain')).toBeNull();
    expect(
      res.headers.get('x-middleware-request-x-merchant-domain')
    ).toBeNull();
  });

  it.each([
    '/agent-commerce.json',
    '/agent-trust.json',
    '/.well-known/agent-native-commerce',
    '/.well-known/ucp',
    '/feeds/google-merchant.xml',
    '/feeds/openai.jsonl',
    '/feeds/agent-products.jsonl',
  ])('passes subdomain machine-readable path %s to the app route', async (path) => {
    const req = new NextRequest(`https://ogabassey.${ROOT_DOMAIN}${path}`);
    req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

    const res = await proxy(req);

    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.headers.get('x-middleware-request-x-merchant-slug')).toBe(
      'ogabassey'
    );
  });

  it.each([
    ['/index.html.md', '/api/llm/ogabassey'],
    ['/about.md', '/api/llm/ogabassey/about'],
    [
      '/laptops/hp-probook-440-g8.md',
      '/api/llm/ogabassey/laptops/hp-probook-440-g8',
    ],
  ])('rewrites custom-domain markdown mirror %s to %s', async (path, expectedPath) => {
    const req = new NextRequest(`https://ogabassey.com${path}`);
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);
    const rewrite = res.headers.get('x-middleware-rewrite');

    expect(rewrite).not.toBeNull();
    expect(new URL(rewrite as string, 'https://ogabassey.com').pathname).toBe(
      expectedPath
    );
  });

  it('routes localhost subdomain markdown mirrors through the subdomain handler', async () => {
    const req = new NextRequest('http://ogabassey.localhost:3000/about.md');
    req.headers.set('host', 'ogabassey.localhost:3000');

    const res = await proxy(req);
    const rewrite = res.headers.get('x-middleware-rewrite');

    expect(rewrite).not.toBeNull();
    expect(
      new URL(rewrite as string, 'http://ogabassey.localhost:3000').pathname
    ).toBe('/api/llm/ogabassey/about');
  });

  it('redirects custom-domain slug-prefixed products path to slugless canonical URL', async () => {
    const req = new NextRequest('https://ogabassey.com/ogabassey/products');
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://ogabassey.com/products');
  });

  it('redirects custom-domain slug-prefixed repair path to slugless canonical URL', async () => {
    const req = new NextRequest('https://ogabassey.com/ogabassey/repair');
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://ogabassey.com/repair');
  });

  it('keeps slug-prefixed sitemap paths out of product-route canonicalization', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/ogabassey/sitemap/products.xml'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/sitemap/products.xml'
    );
    expect(res.headers.get('location')).not.toBe(
      'https://ogabassey.com/products/products.xml'
    );
  });

  it('redirects slug-prefixed legacy category product URLs to /products/{slug}', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/ogabassey/dell/dell-alienware-m16-r3-rtx-5070-ti'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/products/dell-alienware-m16-r3-rtx-5070-ti'
    );
  });

  it('preserves slug-prefixed category support routes when stripping the merchant prefix', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/ogabassey/smartphones/best-under/under-500k'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/smartphones/best-under/under-500k'
    );
  });

  it('redirects mixed-case custom-domain slug-prefixed product URLs to the slugless canonical route', async () => {
    vi.mocked(getSlugForCustomDomain).mockResolvedValueOnce('OgaBassey');
    const req = new NextRequest(
      'https://ogabassey.com/ogabassey/dell/dell-alienware-m16-r3-rtx-5070-ti'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/products/dell-alienware-m16-r3-rtx-5070-ti'
    );
  });

  it.each([
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
  ])('internally rewrites slug-prefixed custom-domain API requests on non-idempotent method %s', async (method) => {
    // Arrange: a slug-prefixed API URL on a custom domain, using a method
    // whose body must not be dropped by a GET-replay after a 301.
    const req = new NextRequest(
      'https://ogabassey.com/ogabassey/api/checkout/create-order',
      { method }
    );
    req.headers.set('host', 'ogabassey.com');

    // Act
    const res = await proxy(req);

    // Assert: the canonicalizing redirect branch must be skipped so the
    // request reaches the API with its body intact. Instead of a 301, the
    // proxy must emit an internal rewrite pointing at the stripped API
    // path (`/api/checkout/create-order`) on the custom domain.
    expect(res.status).not.toBe(301);
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://ogabassey.com/api/checkout/create-order'
    );
  });

  it('returns 410 for legacy WordPress admin probes under /blog', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/blog/wp-admin/post.php?post=7446&action=edit'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(410);
  });

  it.each([
    '/blog/wp-admin',
    '/blog/wp-login.php',
    '/blog/xmlrpc.php',
  ])('returns 410 for exact WordPress probe path %s', async (path) => {
    const req = new NextRequest(`https://ogabassey.com${path}`);
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(410);
  });

  it.each([
    '/blog/wp-admin-guide',
    '/blog/wp-login-security-tips',
    '/blog/xmlrpc-explained',
  ])('does not block legitimate post slugs that share WP probe prefixes: %s', async (path) => {
    const req = new NextRequest(`https://ogabassey.com${path}`);
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    // Legitimate post slugs must never be punted to the 410 WP-probe trap,
    // and must not short-circuit with any other client/server error either
    // — they should flow through the proxy to the storefront handler.
    expect(res.status).not.toBe(410);
    expect(res.status).toBeLessThan(400);
  });

  it.each([
    '/someshop/blog/wp-admin',
    '/someshop/blog/wp-admin/post.php?post=7446&action=edit',
    '/someshop/blog/wp-login.php',
    '/someshop/blog/xmlrpc.php',
  ])('returns 410 for merchant-scoped WordPress probe path %s', async (path) => {
    const req = new NextRequest(`https://ogabassey.com${path}`);
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(410);
  });

  it.each([
    '/someshop/blog/wp-admin-guide',
    '/someshop/blog/wp-login-tips',
  ])('does not block legitimate merchant-scoped post slugs sharing WP probe prefixes: %s', async (path) => {
    const req = new NextRequest(`https://ogabassey.com${path}`);
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    // Same as the platform-scope case: legitimate merchant-scoped slugs
    // must pass through without any 4xx/5xx short-circuit from the proxy.
    expect(res.status).not.toBe(410);
    expect(res.status).toBeLessThan(400);
  });

  it('redirects legacy /blog/{category}/{slug} URLs to canonical /blog/{slug}', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/blog/gadgets/how-to-maintain-your-iphone-battery-health-at-85-and-beyond'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/blog/how-to-maintain-your-iphone-battery-health-at-85-and-beyond'
    );
  });

  it.each([
    'opengraph-image',
    'opengraph-image.png',
    'twitter-image',
    'twitter-image.jpg',
  ])('does not flatten blog post %s metadata routes as legacy category URLs', async (metadataRoute) => {
    const req = new NextRequest(
      `https://ogabassey.com/blog/airpods-max/${metadataRoute}`
    );
    req.headers.set('host', 'ogabassey.com');
    req.headers.set('accept', 'image/avif,image/webp,image/*,*/*;q=0.8');
    req.headers.set('sec-fetch-dest', 'image');

    const res = await proxy(req);

    expect(res.status).not.toBe(301);
    expect(res.headers.get('location')).toBeNull();
    expect(getSlugForCustomDomain).toHaveBeenCalledWith('ogabassey.com');
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      `https://ogabassey.com/ogabassey.com/blog/airpods-max/${metadataRoute}`
    );
  });

  it.each([
    'opengraph-image',
    'twitter-image',
  ])('does not flatten one-word post slug metadata routes: %s', async (metadataRoute) => {
    const req = new NextRequest(
      `https://ogabassey.com/blog/long/${metadataRoute}`
    );
    req.headers.set('host', 'ogabassey.com');
    req.headers.set('accept', 'image/avif,image/webp,image/*,*/*;q=0.8');
    req.headers.set('sec-fetch-dest', 'image');

    const res = await proxy(req);

    expect(res.status).not.toBe(301);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      `https://ogabassey.com/ogabassey.com/blog/long/${metadataRoute}`
    );
  });

  it.each([
    'opengraph-image',
    'twitter-image',
  ])('redirects legacy category paths to canonical post URLs for HTML navigation when slug is %s', async (postSlug) => {
    const req = new NextRequest(
      `https://ogabassey.com/blog/gadgets/${postSlug}`
    );
    req.headers.set('host', 'ogabassey.com');
    req.headers.set(
      'accept',
      'text/html,application/xhtml+xml,image/avif,image/webp,*/*;q=0.8'
    );
    req.headers.set('sec-fetch-dest', 'document');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      `https://ogabassey.com/blog/${postSlug}`
    );
  });

  it.each([
    '/blog/page/2',
    '/blog/tag/iphone',
    '/blog/author/jane',
  ])('does not flatten reserved blog archive routes: %s', async (inputPath) => {
    const req = new NextRequest(`https://ogabassey.com${inputPath}`);
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    // Reserved archive paths must not trigger any 301, including a
    // wasteful self-redirect to the same path. Locking this to "no 301"
    // is the strongest expression of the invariant.
    expect(res.status).not.toBe(301);
  });

  it.each([
    ['_thumbnail_id=1819&ref=mail'],
    ['thumbnail_id=1819&ref=mail'],
    ['_thumbnail_id=1819&thumbnail_id=1820&ref=mail'],
  ])('drops thumbnail query noise on blog post URLs: %s', async (queryString) => {
    const req = new NextRequest(
      `https://ogabassey.com/blog/iphone/the-iphone-15-what-we-know-so-far?${queryString}`
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);
    const location = res.headers.get('location');

    // A single 301 must collapse the legacy category prefix AND drop the
    // thumbnail noise together — chaining two 301s wastes a round-trip and
    // counts against crawler redirect-chain budgets.
    expect(res.status).toBe(301);
    expect(location).toBeTruthy();
    expect(new URL(location ?? '').pathname).toBe(
      '/blog/the-iphone-15-what-we-know-so-far'
    );
    expect(location).toContain('ref=mail');
    expect(location).not.toContain('_thumbnail_id');
    expect(location).not.toContain('thumbnail_id=');
  });

  it('redirects custom-domain slug-prefixed repair path to slugless canonical URL', async () => {
    const req = new NextRequest('https://ogabassey.com/ogabassey/repair');
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://ogabassey.com/repair');
  });

  it('redirects slug-prefixed legacy category product URLs to /products/{slug}', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/ogabassey/dell/dell-alienware-m16-r3-rtx-5070-ti'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/products/dell-alienware-m16-r3-rtx-5070-ti'
    );
  });

  it('preserves merchant category compare subroutes on custom domains', async () => {
    // /{merchantSlug}/{category}/compare/{comparisonSlug} must NOT collapse to
    // /products/{comparisonSlug}; the category subroute is a real page at
    // apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/compare/[comparisonSlug].
    const req = new NextRequest(
      'https://ogabassey.com/ogabassey/smartphones/compare/iphone-15-vs-samsung-s24'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/smartphones/compare/iphone-15-vs-samsung-s24'
    );
  });

  it('preserves merchant category best-under subroutes on custom domains', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/ogabassey/laptops/best-under/500000'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/laptops/best-under/500000'
    );
  });

  it('preserves slug-prefixed legacy /category/{slug} paths on custom domains', async () => {
    // `/category/{slug}` is a legacy category root (see
    // storefront-link-normalization.ts). It must NOT collapse to
    // `/products/{slug}`, which would 301 merchants to a non-existent PDP.
    const req = new NextRequest(
      'https://ogabassey.com/ogabassey/category/smartphones'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/category/smartphones'
    );
  });

  it('preserves slug-prefixed legacy /product-category/{slug} paths on custom domains', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/ogabassey/product-category/laptops'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/product-category/laptops'
    );
  });

  it('returns 410 for legacy WordPress admin probes under /blog', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/blog/wp-admin/post.php?post=7446&action=edit'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(410);
  });

  it('redirects legacy /blog/{category}/{slug} URLs to canonical /blog/{slug}', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/blog/gadgets/how-to-maintain-your-iphone-battery-health-at-85-and-beyond'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/blog/how-to-maintain-your-iphone-battery-health-at-85-and-beyond'
    );
  });

  it('drops thumbnail_id query noise on blog URLs', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/blog/iphone/the-iphone-15-what-we-know-so-far?thumbnail_id=1819'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/blog/the-iphone-15-what-we-know-so-far'
    );
  });

  it('drops _thumbnail_id query noise on blog URLs', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/blog/iphone/the-iphone-15-what-we-know-so-far?_thumbnail_id=1819'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/blog/the-iphone-15-what-we-know-so-far'
    );
  });

  it('does not redirect unrecognized-domain products paths', async () => {
    vi.mocked(getSlugForCustomDomain).mockResolvedValueOnce(null);
    const req = new NextRequest('https://ogabassey.com/products');
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);
    const rewriteUrl = new URL(
      res.headers.get('x-middleware-rewrite') as string
    );

    expect(res.status).not.toBe(301);
    expect(rewriteUrl.pathname).toBe('/ogabassey.com/products');
    expect(
      rewriteUrl.searchParams.get(STOREFRONT_METADATA_CACHE_BUCKET_QUERY_PARAM)
    ).toBe('streaming');
    expect(res.headers.get('x-middleware-rewrite')).toBe(rewriteUrl.toString());
  });

  it('does not 410 legitimate blog slugs that merely start with a wp-admin token', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/blog/wp-admin-guide-for-developers'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).not.toBe(410);
  });

  it('does not 410 legitimate blog slugs that merely start with a spam token', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/blog/shopdetail-roundup-2026'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).not.toBe(410);
  });

  it.each([
    ['/api/blog/posts', 'thumbnail_id=123'],
    ['/dashboard/blog', 'thumbnail_id=foo'],
    ['/admin/blog/analytics', '_thumbnail_id=bar'],
  ])('does NOT strip thumbnail params on reserved top-level paths with /blog children: %s?%s', async (inputPath, queryString) => {
    const req = new NextRequest(
      `https://${ROOT_DOMAIN}${inputPath}?${queryString}`
    );
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);
    const location = res.headers.get('location');

    expect(res.status).not.toBe(301);
    if (location) {
      const thumbnailKey = queryString.split('=')[0];
      expect(location).toContain(thumbnailKey);
    }
  });

  describe('URL normalization: prefix-only case fixing', () => {
    it('lowercases /API prefix but preserves case-sensitive tail', async () => {
      const req = new NextRequest(
        `https://${ROOT_DOMAIN}/API/paystack/virtual-terminal/ABC123`
      );
      req.headers.set('host', ROOT_DOMAIN);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(308);
      expect(location).toBeTruthy();
      expect(new URL(location || '').pathname).toBe(
        '/api/paystack/virtual-terminal/ABC123'
      );
    });

    it('lowercases /TRACK prefix but preserves tracking number case', async () => {
      const req = new NextRequest(`https://${ROOT_DOMAIN}/TRACK/AbC123xYz`);
      req.headers.set('host', ROOT_DOMAIN);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(308);
      expect(location).toBeTruthy();
      expect(new URL(location || '').pathname).toBe('/track/AbC123xYz');
    });

    it('lowercases /_NEXT prefix but preserves build ID case', async () => {
      const req = new NextRequest(
        `https://${ROOT_DOMAIN}/_NEXT/data/BuildId/page.json`
      );
      req.headers.set('host', ROOT_DOMAIN);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(308);
      expect(location).toBeTruthy();
      expect(new URL(location || '').pathname).toBe(
        '/_next/data/BuildId/page.json'
      );
    });

    it('lowercases /FAVICON.ICO prefix but preserves case', async () => {
      const req = new NextRequest(`https://${ROOT_DOMAIN}/FAVICON.ICO`);
      req.headers.set('host', ROOT_DOMAIN);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(308);
      expect(location).toBeTruthy();
      expect(new URL(location || '').pathname).toBe('/favicon.ico');
    });

    it('does not redirect already-lowercase prefix paths', async () => {
      const req = new NextRequest(`https://${ROOT_DOMAIN}/api/products`);
      req.headers.set('host', ROOT_DOMAIN);

      const res = await proxy(req);

      // Should not be a redirect — passes through to normal handling
      expect(res.status).not.toBe(308);
    });
  });

  describe('URL normalization: storefront full-path lowercase', () => {
    it('redirects uppercase storefront path to lowercase', async () => {
      const req = new NextRequest(`https://ogabassey.${ROOT_DOMAIN}/Phones`);
      req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(308);
      expect(location).toBeTruthy();
      expect(new URL(location || '').pathname).toBe('/phones');
    });

    it('redirects uppercase /CHECKOUT/SUCCESS to lowercase', async () => {
      const req = new NextRequest(
        `https://ogabassey.${ROOT_DOMAIN}/CHECKOUT/SUCCESS`
      );
      req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(308);
      expect(location).toBeTruthy();
      expect(new URL(location || '').pathname).toBe('/checkout/success');
    });

    it('does not redirect already-lowercase storefront paths', async () => {
      const req = new NextRequest(`https://ogabassey.${ROOT_DOMAIN}/products`);
      req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

      const res = await proxy(req);

      expect(res.status).not.toBe(308);
    });

    it('does not redirect /.well-known paths', async () => {
      const req = new NextRequest(
        `https://${ROOT_DOMAIN}/.well-known/assetlinks.json`
      );
      req.headers.set('host', ROOT_DOMAIN);

      const res = await proxy(req);

      // .well-known passthrough returns 200 (NextResponse.next())
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('does not redirect /llms.txt', async () => {
      const req = new NextRequest(`https://${ROOT_DOMAIN}/llms.txt`);
      req.headers.set('host', ROOT_DOMAIN);

      const res = await proxy(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('does not redirect static .avif files', async () => {
      const req = new NextRequest(`https://${ROOT_DOMAIN}/images/Hero.avif`);
      req.headers.set('host', ROOT_DOMAIN);

      const res = await proxy(req);

      // Static files should not trigger a lowercase redirect
      expect(res.status).not.toBe(308);
    });

    it('redirects trailing slash static asset variants to canonical asset URLs', async () => {
      const req = new NextRequest(`https://${ROOT_DOMAIN}/favicon.ico/`);
      req.headers.set('host', ROOT_DOMAIN);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(308);
      expect(location).toBeTruthy();
      expect(new URL(location || '').pathname).toBe('/favicon.ico');
    });

    it('does not redirect trailing slash /.well-known paths', async () => {
      const req = new NextRequest(
        `https://${ROOT_DOMAIN}/.well-known/assetlinks.json/`
      );
      req.headers.set('host', ROOT_DOMAIN);

      const res = await proxy(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('does not redirect when only percent-encoded octets differ in case', async () => {
      const req = new NextRequest(
        `https://ogabassey.${ROOT_DOMAIN}/laptop/hp-omnibook-x-copilot%2B-pc`
      );
      req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

      const res = await proxy(req);

      expect(res.status).not.toBe(308);
      expect(res.headers.get('location')).toBeNull();
    });

    it('does not redirect lowercase percent-encoded non-Latin slugs without unsafe punctuation', async () => {
      const req = new NextRequest(
        `https://ogabassey.${ROOT_DOMAIN}/search/%d1%82%d0%b5%d0%bb%d0%b5%d1%84%d0%be%d0%bd-case`
      );
      req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

      const res = await proxy(req);

      expect(res.status).not.toBe(308);
      expect(res.headers.get('location')).toBeNull();
    });

    it('does not collapse ordinary double hyphens without unsafe punctuation', async () => {
      const req = new NextRequest(
        `https://ogabassey.${ROOT_DOMAIN}/accessories/iphone--case`
      );
      req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

      const res = await proxy(req);

      expect(res.status).not.toBe(308);
      expect(res.headers.get('location')).toBeNull();
    });

    it('redirects smart-quote storefront slugs before remote cache handling', async () => {
      const req = new NextRequest(
        `https://ogabassey.${ROOT_DOMAIN}/smartphones/15%E2%80%9D-macbook-air-2023-16gb-512gb-m3`
      );
      req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(308);
      expect(location).toBeTruthy();
      expect(new URL(location || '').pathname).toBe(
        '/smartphones/15-macbook-air-2023-16gb-512gb-m3'
      );
    });

    it('redirects typographic-dash storefront slugs to cache-safe ASCII', async () => {
      const req = new NextRequest(
        `https://ogabassey.${ROOT_DOMAIN}/laptops/dell-alienware-x14-r2-%E2%80%93-14%E2%80%9D`
      );
      req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(308);
      expect(location).toBeTruthy();
      expect(new URL(location || '').pathname).toBe(
        '/laptops/dell-alienware-x14-r2-14'
      );
    });

    it('preserves encoded reserved path separators while normalizing smart punctuation', async () => {
      const req = new NextRequest(
        `https://ogabassey.${ROOT_DOMAIN}/collections/phones%2Fandroid%E2%80%9D`
      );
      req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(308);
      expect(location).toBeTruthy();
      expect(new URL(location || '').pathname).toBe(
        '/collections/phones%2Fandroid'
      );
    });

    it('preserves encoded literal percent signs while normalizing smart punctuation', async () => {
      const req = new NextRequest(
        `https://ogabassey.${ROOT_DOMAIN}/products/100%25-cotton%E2%80%9D`
      );
      req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(308);
      expect(location).toBeTruthy();
      expect(new URL(location || '').pathname).toBe('/products/100%25-cotton');
    });

    it('redirects non-breaking-space storefront slugs to cache-safe ASCII', async () => {
      const req = new NextRequest(
        `https://ogabassey.${ROOT_DOMAIN}/accessories/iphone%C2%A0case`
      );
      req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(308);
      expect(location).toBeTruthy();
      expect(new URL(location || '').pathname).toBe('/accessories/iphone-case');
    });

    it('preserves non-Latin route bytes instead of erasing them', async () => {
      const req = new NextRequest(
        `https://ogabassey.${ROOT_DOMAIN}/search/%D1%82%D0%B5%D0%BB%D0%B5%D1%84%D0%BE%D0%BD%E2%80%9D-case`
      );
      req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

      const res = await proxy(req);
      const location = res.headers.get('location');

      expect(res.status).toBe(308);
      expect(location).toBeTruthy();
      expect(new URL(location || '').pathname).toBe(
        '/search/%D1%82%D0%B5%D0%BB%D0%B5%D1%84%D0%BE%D0%BD-case'
      );

      const followUpReq = new NextRequest(location || '');
      followUpReq.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

      const followUpRes = await proxy(followUpReq);

      expect(followUpRes.status).not.toBe(308);
      expect(followUpRes.headers.get('location')).toBeNull();
    });
  });

  describe('config.matcher', () => {
    it('includes machine-readable agent JSON routes in middleware matching', () => {
      expect(config.matcher).toEqual(
        expect.arrayContaining(['/agent-commerce.json', '/agent-trust.json'])
      );
    });

    it('excludes .avif files from middleware matching', () => {
      // The matcher regex should not match .avif files (they bypass middleware)
      const matcherPattern = config.matcher.find((matcher) =>
        matcher?.includes('_next/image')
      );
      if (!matcherPattern) throw new Error('Static asset matcher is missing');
      const regex = new RegExp(matcherPattern);

      // .avif should NOT match (excluded from middleware)
      expect(regex.test('/images/hero.avif')).toBe(false);
    });

    it('includes trailing slash asset variants so proxy can canonicalize them', () => {
      const matcherPattern = config.matcher.find((matcher) =>
        matcher?.includes('_next/image')
      );
      if (!matcherPattern) throw new Error('Static asset matcher is missing');
      const regex = new RegExp(matcherPattern);

      expect(regex.test('/favicon.ico')).toBe(true);
      expect(regex.test('/favicon.ico/')).toBe(true);
      expect(regex.test('/images/some-icon.ico')).toBe(false);
      expect(regex.test('/robots.txt')).toBe(false);
      expect(regex.test('/robots.txt/')).toBe(true);
      expect(regex.test('/manifest.webmanifest')).toBe(false);
      expect(regex.test('/manifest.webmanifest/')).toBe(true);
      expect(regex.test('/_next/static/chunks/app.js')).toBe(false);
      expect(regex.test('/_next/static/chunks/app.js/')).toBe(true);
    });
  });
});
