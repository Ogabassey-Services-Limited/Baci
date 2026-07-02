import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  removeNativeAbortSignalTimeout,
  restoreAbortSignalTimeout,
} from './abort-signal-timeout.test-utils';
import { resolveStorefrontBlogListingStatus } from './storefront-blog-listing-status';

const ORIGINAL_INTERNAL_BASE_ENV = {
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
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

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: ok ? 200 : 500,
  });
}

const BASE_OPTS = {
  origin: 'https://ogabassey.com',
  identifier: 'ogabassey.com',
  secret: 'internal-secret',
} as const;

describe('resolveStorefrontBlogListingStatus', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    vi.stubEnv('NODE_ENV', 'test');
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    process.env.VERCEL_URL = 'baci-platform.vercel.app';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreAbortSignalTimeout();
    restoreInternalBaseEnv();
    vi.restoreAllMocks();
  });

  it('maps a permanent category redirect to a 308 and builds the query', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        hasError: false,
        redirectPath: '/blog/category/smartphones',
        permanent: true,
        notFound: false,
      })
    );

    const result = await resolveStorefrontBlogListingStatus({
      ...BASE_OPTS,
      intent: { kind: 'category-query', category: 'Smartphones' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({
      kind: 'redirect',
      redirectPath: '/blog/category/smartphones',
      status: 308,
    });
    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.origin).toBe('https://usebaci.com');
    expect(url.pathname).toBe(
      '/api/internal/blog-listing-status/ogabassey.com'
    );
    expect(url.searchParams.get('kind')).toBe('category-query');
    expect(url.searchParams.get('category')).toBe('Smartphones');
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bearer internal-secret' },
      redirect: 'manual',
    });
  });

  it('maps a page-clamp redirect to a 307', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        hasError: false,
        redirectPath: '/blog?page=3',
        permanent: false,
        notFound: false,
      })
    );

    const result = await resolveStorefrontBlogListingStatus({
      ...BASE_OPTS,
      intent: { kind: 'listing-page', page: 99 },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({
      kind: 'redirect',
      redirectPath: '/blog?page=3',
      status: 307,
    });
    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.searchParams.get('page')).toBe('99');
  });

  it('maps a notFound body to a notFound resolution', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ hasError: false, redirectPath: null, notFound: true })
      );

    const result = await resolveStorefrontBlogListingStatus({
      ...BASE_OPTS,
      intent: { kind: 'author', authorSlug: 'bassey-john', page: 1 },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'notFound' });
  });

  it('fails open to noop when redirectPath is unsafe (external URL)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        hasError: false,
        redirectPath: 'https://evil.example/x',
        notFound: false,
      })
    );

    const result = await resolveStorefrontBlogListingStatus({
      ...BASE_OPTS,
      intent: { kind: 'listing-page', page: 99 },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'noop' });
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'unsafe-redirect' })
    );
  });

  it('is a no-op when the secret is absent (never calls the endpoint)', async () => {
    const fetchImpl = vi.fn();
    const result = await resolveStorefrontBlogListingStatus({
      ...BASE_OPTS,
      secret: undefined,
      intent: { kind: 'listing-page', page: 99 },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'noop' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('is a no-op without sending the secret when there is no trusted base URL', async () => {
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    const fetchImpl = vi.fn();

    const result = await resolveStorefrontBlogListingStatus({
      ...BASE_OPTS,
      intent: { kind: 'listing-page', page: 99 },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'noop' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'no-base-url' })
    );
  });

  it('fails open to noop when the endpoint reports hasError', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ hasError: true, redirectPath: null, notFound: false })
      );

    const result = await resolveStorefrontBlogListingStatus({
      ...BASE_OPTS,
      intent: { kind: 'listing-page', page: 99 },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'noop' });
  });

  it('fails open to noop on a non-2xx or non-JSON response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ hasError: false }, false))
      .mockResolvedValueOnce(
        new Response('<!doctype html>', {
          headers: { 'Content-Type': 'text/html' },
          status: 200,
        })
      );

    await expect(
      resolveStorefrontBlogListingStatus({
        ...BASE_OPTS,
        intent: { kind: 'listing-page', page: 99 },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ kind: 'noop' });
    await expect(
      resolveStorefrontBlogListingStatus({
        ...BASE_OPTS,
        intent: { kind: 'listing-page', page: 99 },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ kind: 'noop' });
  });

  it('keeps fetching when native AbortSignal.timeout is unavailable', async () => {
    removeNativeAbortSignalTimeout();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ hasError: false, redirectPath: null, notFound: true })
      );

    const result = await resolveStorefrontBlogListingStatus({
      ...BASE_OPTS,
      intent: { kind: 'listing-page', page: 99 },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'notFound' });
    expect((fetchImpl.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(
      AbortSignal
    );
  });

  it('fails open to noop when the request throws (timeout)', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('aborted'));

    const result = await resolveStorefrontBlogListingStatus({
      ...BASE_OPTS,
      intent: { kind: 'listing-page', page: 99 },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'noop' });
  });
});
