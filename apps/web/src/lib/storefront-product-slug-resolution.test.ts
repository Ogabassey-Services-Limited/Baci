import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveStorefrontProductSlugResolution } from '@/lib/storefront-product-slug-membership';
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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}

describe('resolveStorefrontProductSlugResolution', () => {
  beforeEach(() => {
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
    '/\\evil.example',
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

  it('fails open without fetching when the internal API secret is missing', async () => {
    const fetchImpl = vi.fn();

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      secret: undefined,
      productSlug: 'iphone-15',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'present-or-unknown' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'no-secret' })
    );
  });

  it('fails open without fetching when no trusted internal base URL exists', async () => {
    clearConfiguredInternalBaseEnv();
    const fetchImpl = vi.fn();

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      productSlug: 'iphone-15',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'present-or-unknown' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'no-base-url' })
    );
  });

  it('fails open when the internal slug-set fetch throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));

    const result = await resolveStorefrontProductSlugResolution({
      ...BASE,
      productSlug: 'iphone-15',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'present-or-unknown' });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'fetch-error' })
    );
  });
});
