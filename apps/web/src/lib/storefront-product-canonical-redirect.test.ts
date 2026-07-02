import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getStorefrontProductCanonicalRedirectPath,
  getStorefrontProductCanonicalRedirectResult,
} from './storefront-product-canonical-redirect';

const ORIGINAL_INTERNAL_BASE_ENV = {
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
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

function htmlResponse() {
  return new Response('<!doctype html><title>Login</title>', {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status: 200,
  });
}

function _htmlResponse() {
  return new Response('<!doctype html><title>Login</title>', {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status: 200,
  });
}

describe('getStorefrontProductCanonicalRedirectPath', () => {
  beforeEach(() => {
    clearConfiguredInternalBaseEnv();
    process.env.VERCEL_URL = 'baci-platform.vercel.app';
  });

  afterEach(() => {
    restoreInternalBaseEnv();
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
      'https://baci-platform.vercel.app/api/internal/product-canonical/ogabassey.com?category=apple&slug=iphone-15-128gb'
    );
    expect((init as RequestInit).headers).toEqual({
      Authorization: `Bearer ${SECRET}`,
    });
    expect((init as RequestInit).redirect).toBe('manual');
  });

  it('fails open (unknown) on a 200 text/html login page', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => htmlResponse());

    await expect(
      getStorefrontProductCanonicalRedirectResult({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        category: 'apple',
        productSlug: 'iphone-15-128gb',
        secret: SECRET,
        fetchImpl,
      })
    ).resolves.toEqual({ kind: 'unknown' });
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

  it('pins canonical preflight redirects to the platform origin in production and ignores VERCEL_URL', async () => {
    clearConfiguredInternalBaseEnv();
    vi.stubEnv('VERCEL_ENV', 'production');
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    process.env.VERCEL_URL = 'baci-abc123.vercel.app';
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
