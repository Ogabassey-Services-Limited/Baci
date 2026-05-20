import type { User } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCustomDomainForSlug,
  getSlugForCustomDomain,
} from '@/lib/domain-cache-simple';
import { checkRateLimit } from '@/lib/rate-limit';
import { updateSession } from '@/lib/supabase/middleware';
import { config, proxy } from './proxy';

const AUTHENTICATED_USER: User = {
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2026-03-23T00:00:00.000Z',
  id: 'merchant-user-id',
  user_metadata: {},
};

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

  it.each([
    '/agent-commerce.json',
    '/agent-trust.json',
    '/.well-known/agent-native-commerce',
    '/.well-known/ucp',
    '/feeds/google-merchant.xml',
    '/feeds/openai.jsonl',
    '/feeds/agent-products.jsonl',
  ])('passes custom-domain machine-readable path %s to the app route', async (path) => {
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
    '/agent-commerce.json',
    '/agent-trust.json',
    '/.well-known/agent-native-commerce',
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

    expect(res.status).not.toBe(301);
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://ogabassey.com/ogabassey.com/products'
    );
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
        `https://ogabassey.${ROOT_DOMAIN}/laptop/14%E2%80%9D-hp-omnibook-x-copilot%2B-pc-`
      );
      req.headers.set('host', `ogabassey.${ROOT_DOMAIN}`);

      const res = await proxy(req);

      expect(res.status).not.toBe(308);
      expect(res.headers.get('location')).toBeNull();
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

      expect(regex.test('/favicon.ico')).toBe(false);
      expect(regex.test('/favicon.ico/')).toBe(true);
      expect(regex.test('/robots.txt')).toBe(false);
      expect(regex.test('/robots.txt/')).toBe(true);
      expect(regex.test('/manifest.webmanifest')).toBe(false);
      expect(regex.test('/manifest.webmanifest/')).toBe(true);
      expect(regex.test('/_next/static/chunks/app.js')).toBe(false);
      expect(regex.test('/_next/static/chunks/app.js/')).toBe(true);
    });
  });
});
