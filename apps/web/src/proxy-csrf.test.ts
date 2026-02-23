import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateSession } from '@/lib/supabase/middleware';
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

  it('should set CSRF cookie on protected route with valid session', async () => {
    // Override updateSession to return an authenticated user
    vi.mocked(updateSession).mockResolvedValueOnce({
      supabaseResponse: NextResponse.next(),
      user: { id: 'user-123', email: 'test@example.com' } as never,
    });

    const req = new NextRequest(`https://${ROOT_DOMAIN}/dashboard`);
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);

    // Protected route with valid session should initialize CSRF cookie
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('csrf-token=');
  });

  it('should block PUT requests to /api/* without CSRF token', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/api/products/123`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
    });
    req.headers.set('host', ROOT_DOMAIN);
    req.headers.set('content-type', 'application/json');

    const res = await proxy(req);
    expect(res.status).toBe(403);
  });

  it('should block DELETE requests to /api/* without CSRF token', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/api/products/123`, {
      method: 'DELETE',
    });
    req.headers.set('host', ROOT_DOMAIN);

    const res = await proxy(req);
    expect(res.status).toBe(403);
  });

  it('should block requests when CSRF cookie and header tokens mismatch', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/api/products`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });
    req.headers.set('host', ROOT_DOMAIN);
    req.headers.set('content-type', 'application/json');

    // Set mismatched tokens
    req.cookies.set('csrf-token', 'cookie-token-abc');
    req.headers.set('x-csrf-token', 'header-token-xyz');

    const res = await proxy(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Invalid CSRF token');
  });

  it('should bypass CSRF check for webhook endpoints', async () => {
    const req = new NextRequest(`https://${ROOT_DOMAIN}/api/webhooks/stripe`, {
      method: 'POST',
      body: JSON.stringify({ event: 'payment.completed' }),
    });
    req.headers.set('host', ROOT_DOMAIN);
    req.headers.set('content-type', 'application/json');
    // Deliberately no CSRF token

    const res = await proxy(req);

    // Webhooks should NOT be blocked by CSRF
    expect(res.status).not.toBe(403);
  });
});
