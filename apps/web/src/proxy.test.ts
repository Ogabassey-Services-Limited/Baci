import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { proxy } from './proxy';
import { checkRateLimit } from '@/lib/rate-limit';

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

  afterEach(() => {
    vi.restoreAllMocks();
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

    // New security headers
    expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(res.headers.get('X-DNS-Prefetch-Control')).toBe('on');
    expect(res.headers.get('X-Permitted-Cross-Domain-Policies')).toBe('none');

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

    // New security headers
    expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');

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

  it('should log rate limit violations', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock rate limit to fail
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      limit: 10,
      remaining: 0,
      resetTime: Date.now() + 60000,
    });

    const req = new NextRequest(`https://${ROOT_DOMAIN}/api/abuse`);
    req.headers.set('host', ROOT_DOMAIN);
    req.headers.set('x-forwarded-for', '1.2.3.4');
    req.headers.set('user-agent', 'TestBot');

    await proxy(req);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Rate limit exceeded'),
      expect.objectContaining({
        ip: '1.2.3.4',
        endpoint: '/api/abuse',
        limit: 10,
      })
    );
  });
});
