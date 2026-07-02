import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  removeNativeAbortSignalTimeout,
  restoreAbortSignalTimeout,
} from './abort-signal-timeout.test-utils';
import { resolveStorefrontBlogPostStatus } from './storefront-blog-post-status';

const ORIGINAL_INTERNAL_BASE_ENV = {
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
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
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;
  vi.stubEnv('NODE_ENV', 'test');
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    type: 'default',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function htmlResponse(): Response {
  return {
    ok: true,
    status: 200,
    type: 'default',
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
    json: () => Promise.reject(new Error('should not parse html as json')),
  } as unknown as Response;
}

function _htmlResponse(): Response {
  return {
    ok: true,
    status: 200,
    type: 'default',
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
    json: () => Promise.reject(new Error('should not parse html as json')),
  } as unknown as Response;
}

describe('resolveStorefrontBlogPostStatus', () => {
  beforeEach(() => {
    clearConfiguredInternalBaseEnv();
    process.env.VERCEL_URL = 'baci-test.vercel.app';
  });

  afterEach(() => {
    restoreAbortSignalTimeout();
    restoreInternalBaseEnv();
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
    expect(url.origin).toBe('https://baci-test.vercel.app');
    expect(url.pathname).toBe('/api/internal/blog-post-status/ogabassey.com');
    expect(url.searchParams.get('slug')).toBe('missing-post');
    expect((init as RequestInit).headers).toEqual({
      Authorization: 'Bearer internal-secret',
    });
    expect((init as RequestInit).redirect).toBe('manual');
  });

  it('pins the internal hop to the platform origin in production and ignores VERCEL_URL', async () => {
    clearConfiguredInternalBaseEnv();
    vi.stubEnv('VERCEL_ENV', 'production');
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    process.env.VERCEL_URL = 'baci-abc123.vercel.app';
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false, present: false }));

    await resolveStorefrontBlogPostStatus({
      origin: 'https://ogabassey.com',
      identifier: 'ogabassey.com',
      postSlug: 'missing-post',
      secret: 'internal-secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.origin).toBe('https://usebaci.com');
  });

  it('fails open when the internal endpoint returns a 200 text/html login page', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(htmlResponse());

    await expect(
      resolveStorefrontBlogPostStatus({
        origin: 'https://ogabassey.com',
        identifier: 'ogabassey.com',
        postSlug: 'missing-post',
        secret: 'internal-secret',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ kind: 'present-or-unknown' });
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
