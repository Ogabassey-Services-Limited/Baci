import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isStorefrontProductSlugMissing } from '@/lib/storefront-product-slug-membership';
import { restoreAbortSignalTimeout } from './abort-signal-timeout.test-utils';

const BASE = {
  origin: 'https://ogabassey.com',
  identifier: 'ogabassey.com',
  secret: 'internal-secret',
};

const ORIGINAL_INTERNAL_BASE_ENV = {
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
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
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;
  vi.stubEnv('NODE_ENV', 'test');
}

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: ok ? 200 : 500,
  });
}

function htmlResponse(status = 200): Response {
  return new Response('<!doctype html><title>SSO</title>', {
    headers: { 'Content-Type': 'text/html' },
    status,
  });
}

describe('isStorefrontProductSlugMissing', () => {
  beforeEach(() => {
    // Production-like by default so the fetch path is exercised; tests that
    // need the no-platform-host behavior delete it explicitly.
    clearConfiguredInternalBaseEnv();
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    process.env.VERCEL_URL = 'baci-test.vercel.app';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreAbortSignalTimeout();
    restoreInternalBaseEnv();
    vi.restoreAllMocks();
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

  it('skips the internal fetch for over-encoded bot slugs and falls through', async () => {
    const fetchImpl = vi.fn();
    let overEncodedSlug = 'samsung-s10 8gb-128gb';
    for (let i = 0; i < 10; i++) {
      overEncodedSlug = encodeURIComponent(overEncodedSlug);
    }

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: overEncodedSlug,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] skip',
      expect.objectContaining({
        surface: 'product-slug',
        reason: 'over-encoded',
      })
    );
  });

  it('skips the internal fetch for extremely long slugs with a bounded log', async () => {
    const fetchImpl = vi.fn();

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'a'.repeat(4000),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    const skipCall = vi
      .mocked(console.warn)
      .mock.calls.find(
        ([message]) => message === '[storefront-internal-preflight] skip'
      );
    expect(skipCall).toBeDefined();
    const context = skipCall?.[1] as { reason: string; slug: string };
    expect(context.reason).toBe('too-long');
    expect(context.slug.length).toBeLessThan(200);
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

  it('fails open on redirects instead of following an SSO wall', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(htmlResponse(302));

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'redirect', status: 302 })
    );
  });

  it('fails open on non-JSON success responses instead of parsing HTML', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(htmlResponse(200));

    const result = await isStorefrontProductSlugMissing({
      ...BASE,
      productSlug: 'totally-made-up',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'non-json', status: 200 })
    );
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
