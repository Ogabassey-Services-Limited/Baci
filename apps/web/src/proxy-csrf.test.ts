import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from './proxy';

// Mock dependencies
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: vi.fn().mockResolvedValue({
    supabaseResponse: NextResponse.next(),
    user: null,
  }),
}));

vi.mock('@/lib/ad-tracking-cookies', () => ({
  CLICK_ID_PARAMS: {},
  extractClickIdsFromUrl: vi.fn().mockReturnValue({}),
  generateClickIdCookies: vi.fn().mockReturnValue([]),
}));

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://example.supabase.co',
  getSupabaseAnonKey: () => 'anon-key',
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    limit: 100,
    remaining: 99,
    resetTime: Date.now() + 60000,
  }),
  createRateLimitResponse: vi.fn(),
}));

vi.mock('@/lib/domain-cache-simple', () => ({
  getCustomDomainForSlug: vi.fn().mockResolvedValue(null),
}));

describe('Middleware CSRF Protection', () => {
  const ROOT_DOMAIN = 'usebaci.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set CSRF cookie on GET requests if missing', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/`);
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);

    // Check Set-Cookie header
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    // In test environment (not PROD), it should set csrf-token
    expect(setCookie).toContain('csrf-token=');
  });

  it('should block POST API requests without CSRF token', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/api/products`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });
    req.headers.set('host', ROOT_DOMAIN);
    req.headers.set('content-type', 'application/json');

    const res = await proxy(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Invalid CSRF token');
  });

  it('should allow POST API requests with valid CSRF token', async () => {
    // 1. Generate a token (we can just use any string for the cookie, and match it in header)
    const validToken = 'valid-token-123';

    const req = new NextRequest(`https://${ROOT_DOMAIN}/api/products`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });
    req.headers.set('host', ROOT_DOMAIN);
    req.headers.set('content-type', 'application/json');

    // Set cookie and header
    req.cookies.set('csrf-token', validToken);
    req.headers.set('x-csrf-token', validToken);

    const res = await proxy(req);

    expect(res.status).not.toBe(403);

    // It should have security headers (from applySecurityHeaders)
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('should allow GET API requests (no CSRF check)', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/api/products`, {
      method: 'GET',
    });
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);

    expect(res.status).not.toBe(403);
    // Should set cookie if missing
    expect(res.headers.get('set-cookie')).toContain('csrf-token=');
  });
});
