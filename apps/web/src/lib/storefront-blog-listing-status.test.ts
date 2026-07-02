import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveStorefrontBlogListingStatus } from './storefront-blog-listing-status';

const ORIGINAL_INTERNAL_BASE_ENV = {
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
};

function restoreInternalBaseEnv() {
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(ORIGINAL_INTERNAL_BASE_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as unknown as Response;
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
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    vi.stubEnv('NODE_ENV', 'test');
    process.env.VERCEL_URL = 'baci-test.vercel.app';
  });

  afterEach(() => {
    restoreInternalBaseEnv();
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
    expect(url.pathname).toBe(
      '/api/internal/blog-listing-status/ogabassey.com'
    );
    expect(url.searchParams.get('kind')).toBe('category-query');
    expect(url.searchParams.get('category')).toBe('Smartphones');
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

  it('fails open to noop on a non-2xx response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hasError: false }, false));

    const result = await resolveStorefrontBlogListingStatus({
      ...BASE_OPTS,
      intent: { kind: 'listing-page', page: 99 },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ kind: 'noop' });
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
