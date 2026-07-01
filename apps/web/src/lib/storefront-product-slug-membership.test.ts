import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isStorefrontProductSlugMissing,
  resolveStorefrontProductSlugResolution,
} from '@/lib/storefront-product-slug-membership';
import {
  removeNativeAbortSignalTimeout,
  restoreAbortSignalTimeout,
} from './abort-signal-timeout.test-utils';

const BASE = {
  origin: 'https://ogabassey.com',
  identifier: 'ogabassey.com',
  secret: 'internal-secret',
};

const ORIGINAL_INTERNAL_BASE_ENV = {
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
};

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
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;
  vi.stubEnv('NODE_ENV', 'test');
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('isStorefrontProductSlugMissing', () => {
  beforeEach(() => {
    // Production-like by default so the fetch path is exercised; tests that
    // need the no-platform-host behavior delete it explicitly.
    clearConfiguredInternalBaseEnv();
    process.env.VERCEL_URL = 'baci-test.vercel.app';
  });

  afterEach(() => {
    restoreAbortSignalTimeout();
    restoreInternalBaseEnv();
  });

  it('returns true only when the route reports the slug error-free absent', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: false }));

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(true);
    // The internal route is called with the bearer secret, the identifier, and
    // the product slug as a query param (membership is decided server-side).
    const [calledUrl, init] = fetchImpl.mock.calls[0];
    const url = new URL(String(calledUrl));
    expect(url.pathname).toBe('/api/internal/slug-set/ogabassey.com');
    expect(url.searchParams.get('slug')).toBe('totally-made-up');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer internal-secret',
    });
  });

  it('returns false (present) when the route reports the slug present', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: true }));

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'iphone-15',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
  });

  it('routes through the platform host (VERCEL_URL) when set, not the custom domain', async () => {
    process.env.VERCEL_URL = 'baci-abc123.vercel.app';
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: false }));

    await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.host).toBe('baci-abc123.vercel.app');
  });

  it('uses VERCEL_PROJECT_PRODUCTION_URL when VERCEL_URL is unavailable', async () => {
    delete process.env.VERCEL_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'usebaci.com';
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: false }));

    await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.origin).toBe('https://usebaci.com');
  });

  it('uses NEXT_PUBLIC_SITE_URL as a configured platform origin', async () => {
    delete process.env.VERCEL_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://usebaci.com';
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: false }));

    await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.origin).toBe('https://usebaci.com');
  });

  it('uses the configured root domain fallback only in production', async () => {
    clearConfiguredInternalBaseEnv();
    vi.stubEnv('NODE_ENV', 'production');
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: false }));

    await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.origin).toBe('https://usebaci.com');
  });

  it('uses a loopback origin when VERCEL_URL is unset (local dev)', async () => {
    clearConfiguredInternalBaseEnv();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: false }));

    await isStorefrontProductSlugMissing({
      ...BASE,
      origin: 'http://localhost:3000',
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.host).toBe('localhost:3000');
  });

  it('fails open WITHOUT sending the secret when VERCEL_URL is unset and the origin is a custom domain', async () => {
    // Defense-in-depth: `origin` is derived from the spoofable request Host, so
    // the internal bearer secret must never be sent to a request-derived domain.
    clearConfiguredInternalBaseEnv();
    const fetchImpl = vi.fn();

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      origin: 'https://ogabassey.com',
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails open when the secret is missing (no fetch)', async () => {
    const fetchImpl = vi.fn();

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      secret: undefined,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails open on a non-2xx response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ hasError: false, present: false }, false)
      );

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
  });

  it('fails open on hasError', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: true, present: false }));

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
  });

  it('fails open on a malformed/ambiguous response (present undefined)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false }));

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
  });

  it('fails open on a fetch/transport error or timeout', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('timeout'));

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
  });
});

describe('resolveStorefrontProductSlugResolution', () => {
  beforeEach(() => {
    clearConfiguredInternalBaseEnv();
    process.env.VERCEL_URL = 'baci-test.vercel.app';
  });

  afterEach(() => {
    restoreAbortSignalTimeout();
    restoreInternalBaseEnv();
  });

  it('returns redirect for a safe internal redirectPath from the route', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        hasError: false,
        present: true,
        redirectPath: '/smartphones/iphone-15-pro-max',
      })
    );

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      productSlug: 'iphone-15-pro-max-8gb-256gb',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({
      kind: 'redirect',
      redirectPath: '/smartphones/iphone-15-pro-max',
    });
  });

  it.each([
    'https://evil.example/path',
    '//evil.example/path',
    '/\\\\evil.example',
    '/smartphones/iphone:15',
    '/%2f%2fevil.example/path',
    '/smartphones/iphone%3a15',
    '',
  ])('fails open for unsafe redirectPath %s', async (redirectPath) => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        hasError: false,
        present: true,
        redirectPath,
      })
    );

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      productSlug: 'iphone-15-pro-max-8gb-256gb',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'present-or-unknown' });
  });

  it('returns present-or-unknown for a present product without a redirectPath', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: true }));

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      productSlug: 'iphone-15',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'present-or-unknown' });
  });

  it('returns missing only for an explicit error-free absent verdict', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: false }));

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      productSlug: 'not-real',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'missing' });
  });

  it('keeps fetching when native AbortSignal.timeout is unavailable', async () => {
    removeNativeAbortSignalTimeout();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: false }));

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      productSlug: 'not-real',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'missing' });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect((fetchImpl.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(
      AbortSignal
    );
  });
});
