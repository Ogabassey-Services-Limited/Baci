import type { User } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSlugForCustomDomain } from '@/lib/domain-cache-simple';
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

  it('preserves non-thumbnail query params when dropping blog thumbnail noise', async () => {
    const req = new NextRequest(
      'https://ogabassey.com/blog/iphone/the-iphone-15-what-we-know-so-far?thumbnail_id=1819&utm_source=newsletter'
    );
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://ogabassey.com/blog/the-iphone-15-what-we-know-so-far?utm_source=newsletter'
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
    it('excludes .avif files from middleware matching', () => {
      // The matcher regex should not match .avif files (they bypass middleware)
      const matcherPattern = config.matcher[0];
      const regex = new RegExp(matcherPattern);

      // .avif should NOT match (excluded from middleware)
      expect(regex.test('/images/hero.avif')).toBe(false);
    });
  });
});
