import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  removeNativeAbortSignalTimeout,
  restoreAbortSignalTimeout,
} from './abort-signal-timeout.test-utils';
import { getStorefrontProductCanonicalRedirectResult } from './storefront-product-canonical-redirect';

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

const BASE_OPTIONS = {
  origin: 'https://ogabassey.com',
  identifier: 'ogabassey.com',
  category: 'smartphones',
  productSlug: 'iphone-15',
  secret: SECRET,
};

describe('getStorefrontProductCanonicalRedirectResult preflight handling', () => {
  beforeEach(() => {
    clearConfiguredInternalBaseEnv();
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    process.env.VERCEL_URL = 'baci-platform.vercel.app';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreAbortSignalTimeout();
    restoreInternalBaseEnv();
    vi.restoreAllMocks();
  });

  it('fails open on malformed canonical response bodies', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ hasError: 'false', matchedProduct: true })
    );

    await expect(
      getStorefrontProductCanonicalRedirectResult({
        ...BASE_OPTIONS,
        fetchImpl,
      })
    ).resolves.toEqual({ kind: 'unknown' });
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'parse' })
    );
  });

  it('keeps fetching when native AbortSignal.timeout is unavailable', async () => {
    removeNativeAbortSignalTimeout();
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ hasError: false, matchedProduct: true })
    );

    await expect(
      getStorefrontProductCanonicalRedirectResult({
        ...BASE_OPTIONS,
        fetchImpl,
      })
    ).resolves.toEqual({ kind: 'checked-no-redirect' });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect((fetchImpl.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(
      AbortSignal
    );
  });

  it('returns unknown when deployment protection returns a redirect or HTML', async () => {
    const redirectFetch = vi.fn<typeof fetch>(
      async () =>
        new Response('<!doctype html>', {
          headers: { 'Content-Type': 'text/html' },
          status: 302,
        })
    );
    const htmlFetch = vi.fn<typeof fetch>(
      async () =>
        new Response('<!doctype html>', {
          headers: { 'Content-Type': 'text/html' },
          status: 200,
        })
    );

    await expect(
      getStorefrontProductCanonicalRedirectResult({
        ...BASE_OPTIONS,
        productSlug: 'missing-product',
        fetchImpl: redirectFetch,
      })
    ).resolves.toEqual({ kind: 'unknown' });
    expect(redirectFetch.mock.calls[0][1]).toMatchObject({
      redirect: 'manual',
    });

    await expect(
      getStorefrontProductCanonicalRedirectResult({
        ...BASE_OPTIONS,
        productSlug: 'missing-product',
        fetchImpl: htmlFetch,
      })
    ).resolves.toEqual({ kind: 'unknown' });
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'non-json', status: 200 })
    );
  });
});
