import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getStorefrontProductCanonicalRedirectPath,
  getStorefrontProductCanonicalRedirectResult,
} from './storefront-product-canonical-redirect';

const ORIGINAL_INTERNAL_BASE_ENV = {
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
};
const SECRET = 'test-secret';

function restoreInternalBaseEnv() {
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(ORIGINAL_INTERNAL_BASE_ENV)) {
    if (key === 'NODE_ENV') continue;
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function clearConfiguredInternalBaseEnv() {
  delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;
  vi.stubEnv('NODE_ENV', 'test');
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

describe('getStorefrontProductCanonicalRedirectPath', () => {
  beforeEach(() => {
    clearConfiguredInternalBaseEnv();
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    process.env.VERCEL_URL = 'baci-platform.vercel.app';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreInternalBaseEnv();
    vi.restoreAllMocks();
  });

  it('returns a safe canonical redirect path from the internal endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ hasError: false, redirectPath: '/smartphones/iphone-15' })
    );

    const result = await getStorefrontProductCanonicalRedirectPath({
      origin: 'https://ogabassey.com',
      identifier: 'ogabassey.com',
      category: 'apple',
      productSlug: 'iphone-15-128gb',
      secret: SECRET,
      fetchImpl,
    });

    expect(result).toBe('/smartphones/iphone-15');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      'https://usebaci.com/api/internal/product-canonical/ogabassey.com?category=apple&slug=iphone-15-128gb'
    );
    expect((init as RequestInit).headers).toEqual({
      Authorization: `Bearer ${SECRET}`,
    });
  });

  it('returns checked-no-redirect when the internal endpoint matched a canonical product', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        hasError: false,
        matchedProduct: true,
        redirectPath: null,
      })
    );

    await expect(
      getStorefrontProductCanonicalRedirectResult({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        category: 'smartphones',
        productSlug: 'iphone-15',
        secret: SECRET,
        fetchImpl,
      })
    ).resolves.toEqual({ kind: 'checked-no-redirect' });
  });

  it('skips the internal fetch for over-encoded bot product slugs', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    let overEncodedSlug = 'samsung-s10 8gb-128gb';
    for (let i = 0; i < 10; i++) {
      overEncodedSlug = encodeURIComponent(overEncodedSlug);
    }

    await expect(
      getStorefrontProductCanonicalRedirectResult({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        category: 'smartphones',
        productSlug: overEncodedSlug,
        secret: SECRET,
        fetchImpl,
      })
    ).resolves.toEqual({ kind: 'unknown' });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] skip',
      expect.objectContaining({
        surface: 'product-canonical',
        reason: 'over-encoded',
      })
    );
  });

  it('skips the internal fetch for over-long category segments', async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      getStorefrontProductCanonicalRedirectResult({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        category: 'c'.repeat(600),
        productSlug: 'iphone-15',
        secret: SECRET,
        fetchImpl,
      })
    ).resolves.toEqual({ kind: 'unknown' });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] skip',
      expect.objectContaining({
        surface: 'product-canonical',
        reason: 'too-long',
      })
    );
  });

  it('returns unknown when the internal endpoint found no active or legacy product', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        hasError: false,
        matchedProduct: false,
        redirectPath: null,
      })
    );

    await expect(
      getStorefrontProductCanonicalRedirectResult({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        category: 'smartphones',
        productSlug: 'missing-product',
        secret: SECRET,
        fetchImpl,
      })
    ).resolves.toEqual({ kind: 'unknown' });
  });

  it('fails open when the endpoint reports no redirect or an error', async () => {
    await expect(
      getStorefrontProductCanonicalRedirectPath({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        category: 'smartphones',
        productSlug: 'iphone-15',
        secret: SECRET,
        fetchImpl: vi.fn<typeof fetch>(async () =>
          jsonResponse({ hasError: false, redirectPath: null })
        ),
      })
    ).resolves.toBeNull();

    await expect(
      getStorefrontProductCanonicalRedirectPath({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        category: 'smartphones',
        productSlug: 'iphone-15',
        secret: SECRET,
        fetchImpl: vi.fn<typeof fetch>(async () =>
          jsonResponse({
            hasError: true,
            redirectPath: '/smartphones/iphone-15',
          })
        ),
      })
    ).resolves.toBeNull();
  });

  it.each([
    'https://evil.test/x',
    '/\\evil.com',
    '/category/../dashboard',
    '/category/%2e%2e/dashboard',
    '/category/%2e/dashboard',
  ])('rejects unsafe redirect path %s', async (redirectPath) => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ hasError: false, redirectPath })
    );

    await expect(
      getStorefrontProductCanonicalRedirectPath({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        category: 'apple',
        productSlug: 'iphone-15-128gb',
        secret: SECRET,
        fetchImpl,
      })
    ).resolves.toBeNull();
  });

  it('uses the production root domain fallback for canonical preflight redirects', async () => {
    clearConfiguredInternalBaseEnv();
    vi.stubEnv('NODE_ENV', 'production');
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ hasError: false, redirectPath: '/earbuds/airpods-pro' })
    );

    await expect(
      getStorefrontProductCanonicalRedirectPath({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        category: 'audio',
        productSlug: 'airpods-pro',
        secret: SECRET,
        fetchImpl,
      })
    ).resolves.toBe('/earbuds/airpods-pro');

    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      'https://usebaci.com/api/internal/product-canonical/ogabassey.com?category=audio&slug=airpods-pro'
    );
    expect(fetchImpl.mock.calls[0][1]?.headers).toEqual({
      Authorization: `Bearer ${SECRET}`,
    });
  });

  it('does not send the secret when there is no trusted internal base URL', async () => {
    clearConfiguredInternalBaseEnv();
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ hasError: false })
    );

    await expect(
      getStorefrontProductCanonicalRedirectPath({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        category: 'apple',
        productSlug: 'iphone-15-128gb',
        secret: SECRET,
        fetchImpl,
      })
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
