import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { checkCsrfProtection } from '@/lib/csrf';
import { proxy } from './proxy';

// Mock CSRF
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn().mockResolvedValue({ valid: true }),
  generateCsrfToken: vi.fn().mockReturnValue('mock-csrf-token'),
  CSRF_TOKEN_NAME: 'csrf-token',
}));

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

describe('Middleware Proxy', () => {
  const ROOT_DOMAIN = 'usebaci.com';

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

  it('should block API requests with invalid CSRF token', async () => {
    // Mock CSRF check failure
    vi.mocked(checkCsrfProtection).mockResolvedValueOnce({
      valid: false,
      response: new NextResponse('Forbidden', { status: 403 }),
    });

    const req = new NextRequest(`https://${ROOT_DOMAIN}/api/mutation`, {
      method: 'POST',
    });
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);
    expect(res.status).toBe(403);
  });

  it('should set CSRF cookie if missing', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/`);
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);

    // Check Set-Cookie header
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('csrf-token=mock-csrf-token');
  });

  it('should not set CSRF cookie if already present', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/`, {
      headers: {
        host: ROOT_DOMAIN,
        cookie: 'csrf-token=existing-token',
      },
    });

    const res = await proxy(req);

    const setCookie = res.headers.get('set-cookie');
    // If other cookies are set, ensure csrf-token is NOT among them
    if (setCookie) {
      expect(setCookie).not.toContain('csrf-token=mock-csrf-token');
    } else {
      expect(setCookie).toBeNull();
    }
  });
});
