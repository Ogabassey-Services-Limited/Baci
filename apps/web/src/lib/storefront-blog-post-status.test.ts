import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  removeNativeAbortSignalTimeout,
  restoreAbortSignalTimeout,
} from './abort-signal-timeout.test-utils';
import { resolveStorefrontBlogPostStatus } from './storefront-blog-post-status';

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

describe('resolveStorefrontBlogPostStatus', () => {
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

  it('returns missing only when the internal endpoint reports an error-free absent post', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: false }));

    const result = await resolveStorefrontBlogPostStatus({
      origin: 'https://ogabassey.com',
      identifier: 'ogabassey.com',
      postSlug: 'missing-post',
      secret: 'internal-secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'missing' });
    const [calledUrl, init] = fetchImpl.mock.calls[0];
    const url = new URL(String(calledUrl));
    expect(url.origin).toBe('https://usebaci.com');
    expect(url.pathname).toBe('/api/internal/blog-post-status/ogabassey.com');
    expect(url.searchParams.get('slug')).toBe('missing-post');
    expect((init as RequestInit).headers).toEqual({
      Authorization: 'Bearer internal-secret',
    });
  });

  it('reports over-encoded bot post slugs as missing (hard 404) without fetching', async () => {
    const fetchImpl = vi.fn();
    let overEncodedSlug = 'my blog post';
    for (let i = 0; i < 10; i++) {
      overEncodedSlug = encodeURIComponent(overEncodedSlug);
    }

    const result = await resolveStorefrontBlogPostStatus({
      origin: 'https://ogabassey.com',
      identifier: 'ogabassey.com',
      postSlug: overEncodedSlug,
      secret: 'internal-secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // Unsafe slug is definitively absent → missing (proxy emits a real 404).
    expect(result).toEqual({ kind: 'missing' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] skip',
      expect.objectContaining({
        surface: 'blog-post-status',
        reason: 'over-encoded',
      })
    );
  });

  it('keeps fetching when native AbortSignal.timeout is unavailable', async () => {
    removeNativeAbortSignalTimeout();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: false }));

    const result = await resolveStorefrontBlogPostStatus({
      origin: 'https://ogabassey.com',
      identifier: 'ogabassey.com',
      postSlug: 'missing-post',
      secret: 'internal-secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'missing' });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect((fetchImpl.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(
      AbortSignal
    );
  });

  it('returns redirect only for safe internal blog redirect paths', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        hasError: false,
        present: true,
        redirectPath: '/blog/canonical-post',
      })
    );

    await expect(
      resolveStorefrontBlogPostStatus({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        postSlug: 'retired-post',
        secret: 'internal-secret',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({
      kind: 'redirect',
      redirectPath: '/blog/canonical-post',
    });
  });

  it.each([
    { hasError: false, present: true },
    { hasError: true, present: false },
    {
      hasError: false,
      present: true,
      redirectPath: 'https://evil.test/blog/x',
    },
  ])('fails open for non-missing or unsafe body %o', async (body) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));

    await expect(
      resolveStorefrontBlogPostStatus({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        postSlug: 'post',
        secret: 'internal-secret',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ kind: 'present-or-unknown' });
  });

  it('fails open when the internal endpoint returns an invalid response body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        hasError: 'false',
        present: false,
        redirectPath: null,
      })
    );

    await expect(
      resolveStorefrontBlogPostStatus({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        postSlug: 'post',
        secret: 'internal-secret',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ kind: 'present-or-unknown' });
  });

  it('fails open without calling the endpoint when the internal secret is missing', async () => {
    const fetchImpl = vi.fn();

    await expect(
      resolveStorefrontBlogPostStatus({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        postSlug: 'post',
        secret: undefined,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ kind: 'present-or-unknown' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails open when the internal endpoint returns a non-OK response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false));

    await expect(
      resolveStorefrontBlogPostStatus({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        postSlug: 'post',
        secret: 'internal-secret',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ kind: 'present-or-unknown' });
  });

  it('fails open when the internal endpoint redirects to deployment protection', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(htmlResponse(302));

    await expect(
      resolveStorefrontBlogPostStatus({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        postSlug: 'post',
        secret: 'internal-secret',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ kind: 'present-or-unknown' });
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'redirect', status: 302 })
    );
  });

  it('fails open when the internal endpoint returns HTML with a 200 status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(htmlResponse(200));

    await expect(
      resolveStorefrontBlogPostStatus({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        postSlug: 'post',
        secret: 'internal-secret',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ kind: 'present-or-unknown' });
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'non-json', status: 200 })
    );
  });

  it('fails open when the internal endpoint request throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network failed'));

    await expect(
      resolveStorefrontBlogPostStatus({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        postSlug: 'post',
        secret: 'internal-secret',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ kind: 'present-or-unknown' });
  });

  it('fails open when the internal endpoint request is aborted', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new DOMException('timed out', 'AbortError'));

    await expect(
      resolveStorefrontBlogPostStatus({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        postSlug: 'post',
        secret: 'internal-secret',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ kind: 'present-or-unknown' });
  });

  it('does not send the secret when there is no trusted internal base URL', async () => {
    clearConfiguredInternalBaseEnv();
    const fetchImpl = vi.fn();

    await expect(
      resolveStorefrontBlogPostStatus({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        postSlug: 'missing-post',
        secret: 'internal-secret',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ kind: 'present-or-unknown' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
