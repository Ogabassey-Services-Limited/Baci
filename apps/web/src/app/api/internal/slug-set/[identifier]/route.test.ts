import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';

const mockGetInternalApiSecret = vi.fn();
const mockGetMerchantSafe = vi.fn();
const mockGetCachedStorefrontProductSlugSet = vi.fn();
const mockGetCachedStorefrontProductSlugResolution = vi.fn();
const mockGetProductUrl = vi.fn();

vi.mock('@/env', () => ({
  getInternalApiSecret: () => mockGetInternalApiSecret(),
}));
vi.mock('@/lib/cached-data', () => ({
  getMerchantSafe: (...args: unknown[]) => mockGetMerchantSafe(...args),
}));
vi.mock('@/lib/cached-storefront-product-slug-set', () => ({
  getCachedStorefrontProductSlugSet: (...args: unknown[]) =>
    mockGetCachedStorefrontProductSlugSet(...args),
}));
vi.mock('@/lib/cached-storefront-product-slug-resolution', () => ({
  getCachedStorefrontProductSlugResolution: (...args: unknown[]) =>
    mockGetCachedStorefrontProductSlugResolution(...args),
}));
vi.mock('@/lib/seo-utils', () => ({
  getProductUrl: (...args: unknown[]) => mockGetProductUrl(...args),
}));

import { GET } from './route';

const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
const IDENTIFIER = 'ogabassey.com';
const SECRET = 'test-internal-secret';
const FAIL_OPEN = { hasError: true, present: false };

function request(slug: string | null, authHeader?: string): NextRequest {
  const url = new URL(
    `https://ogabassey.com/api/internal/slug-set/${IDENTIFIER}`
  );
  if (slug !== null) url.searchParams.set('slug', slug);
  return new NextRequest(
    url,
    authHeader ? { headers: { Authorization: authHeader } } : undefined
  );
}

function context(identifier = IDENTIFIER) {
  return { params: Promise.resolve({ identifier }) };
}

describe('GET /api/internal/slug-set/[identifier]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInternalApiSecret.mockReturnValue(SECRET);
    mockGetMerchantSafe.mockResolvedValue({
      id: MERCHANT_ID,
      is_published: true,
    });
    mockGetCachedStorefrontProductSlugSet.mockResolvedValue({
      hasError: false,
      slugs: ['iphone-15', 'macbook-air-m1'],
    });
    mockGetCachedStorefrontProductSlugResolution.mockResolvedValue({
      hasError: false,
      present: true,
    });
    mockGetProductUrl.mockImplementation(
      (product: { categories?: { slug?: string } | null; slug: string }) =>
        `/${product.categories?.slug ?? 'products'}/${product.slug}`
    );
  });

  it('returns present:true when the slug exists for the merchant', async () => {
    const res = await GET(request('iphone-15', `Bearer ${SECRET}`), context());

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(
      's-maxage=300, stale-while-revalidate=3600'
    );
    // Vary: Authorization keeps a shared cache from replaying this bearer-gated
    // 200 to an unauthenticated caller (RFC 9111 §3.5).
    expect(res.headers.get('Vary')).toBe('Authorization');
    expect(await res.json()).toEqual({ hasError: false, present: true });
    expect(mockGetMerchantSafe).toHaveBeenCalledWith(IDENTIFIER);
    expect(mockGetCachedStorefrontProductSlugSet).toHaveBeenCalledWith(
      MERCHANT_ID
    );
    expect(mockGetCachedStorefrontProductSlugResolution).toHaveBeenCalledWith(
      MERCHANT_ID,
      'iphone-15'
    );
  });

  it('returns redirectPath with no-store when a present slug is an archived alias for a canonical product', async () => {
    mockGetCachedStorefrontProductSlugSet.mockResolvedValue({
      hasError: false,
      slugs: ['iphone-15-pro-max-8gb-256gb'],
    });
    mockGetCachedStorefrontProductSlugResolution.mockResolvedValue({
      hasError: false,
      present: true,
      redirectTarget: {
        id: 'parent-1',
        name: 'iPhone 15 Pro Max',
        slug: 'iphone-15-pro-max',
        category: 'Smartphones',
        categories: {
          id: 'category-1',
          name: 'Smartphones',
          slug: 'smartphones',
          parent_id: null,
        },
      },
    });

    const res = await GET(
      request('iphone-15-pro-max-8gb-256gb', `Bearer ${SECRET}`),
      context()
    );

    expect(res.status).toBe(200);
    // A legacy-alias redirect verdict must NOT be edge-cached: the canonical
    // target can change or the alias slug be reused, and revalidateTag can't
    // purge this header-based edge entry, so a cached redirect would 308 to the
    // wrong product for the whole TTL window.
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({
      hasError: false,
      present: true,
      redirectPath: '/smartphones/iphone-15-pro-max',
    });
  });

  it('keeps present:true without redirectPath when legacy resolution is uncertain', async () => {
    mockGetCachedStorefrontProductSlugResolution.mockResolvedValue({
      hasError: true,
      present: false,
    });

    const res = await GET(request('iphone-15', `Bearer ${SECRET}`), context());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hasError: false, present: true });
  });

  it('keeps present:true and logs when legacy resolution throws', async () => {
    const warnSpy = vi
      .spyOn(logger, 'warn')
      .mockImplementation(() => undefined);
    mockGetCachedStorefrontProductSlugResolution.mockRejectedValueOnce(
      new Error('resolution unavailable')
    );

    try {
      const res = await GET(
        request('iphone-15', `Bearer ${SECRET}`),
        context()
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ hasError: false, present: true });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to resolve legacy product redirect target',
          merchantId: MERCHANT_ID,
          slug: 'iphone-15',
        })
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('rejects unsafe legacy redirect paths and falls through as present', async () => {
    mockGetCachedStorefrontProductSlugSet.mockResolvedValue({
      hasError: false,
      slugs: ['iphone-15-pro-max-8gb-256gb'],
    });
    mockGetCachedStorefrontProductSlugResolution.mockResolvedValue({
      hasError: false,
      present: true,
      redirectTarget: {
        id: 'parent-1',
        name: 'iPhone 15 Pro Max',
        slug: 'iphone-15-pro-max',
        category: 'Smartphones',
        categories: {
          id: 'category-1',
          name: 'Smartphones',
          slug: 'smartphones',
          parent_id: null,
        },
      },
    });
    mockGetProductUrl.mockReturnValueOnce('//evil.example/path');

    const res = await GET(
      request('iphone-15-pro-max-8gb-256gb', `Bearer ${SECRET}`),
      context()
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hasError: false, present: true });
  });

  it('rejects URL-encoded unsafe legacy redirect paths and falls through as present', async () => {
    mockGetCachedStorefrontProductSlugSet.mockResolvedValue({
      hasError: false,
      slugs: ['iphone-15-pro-max-8gb-256gb'],
    });
    mockGetCachedStorefrontProductSlugResolution.mockResolvedValue({
      hasError: false,
      present: true,
      redirectTarget: {
        id: 'parent-1',
        name: 'iPhone 15 Pro Max',
        slug: 'iphone-15-pro-max',
        category: 'Smartphones',
        categories: {
          id: 'category-1',
          name: 'Smartphones',
          slug: 'smartphones',
          parent_id: null,
        },
      },
    });
    mockGetProductUrl.mockReturnValueOnce('/%2f%2fevil.example/path');

    const res = await GET(
      request('iphone-15-pro-max-8gb-256gb', `Bearer ${SECRET}`),
      context()
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hasError: false, present: true });
  });

  it('returns present:false with no-store so a later-published slug is never sticky-404ed', async () => {
    const res = await GET(
      request('nonexistent-product', `Bearer ${SECRET}`),
      context()
    );

    expect(res.status).toBe(200);
    // A definitively-absent verdict drives the proxy's hard-404. It MUST stay
    // no-store: if the merchant publishes this slug, revalidateTag cannot purge
    // an edge-cached miss, so a cached present:false would hard-404 the now-live
    // product for the whole TTL window.
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ hasError: false, present: false });
    expect(mockGetCachedStorefrontProductSlugResolution).not.toHaveBeenCalled();
  });

  it('matches the slug case-insensitively', async () => {
    const res = await GET(request('IPHONE-15', `Bearer ${SECRET}`), context());

    expect(await res.json()).toEqual({ hasError: false, present: true });
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const res = await GET(request('iphone-15'), context());

    expect(res.status).toBe(401);
    expect(mockGetMerchantSafe).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer token does not match', async () => {
    const res = await GET(
      request('iphone-15', 'Bearer wrong-secret'),
      context()
    );

    expect(res.status).toBe(401);
    expect(mockGetMerchantSafe).not.toHaveBeenCalled();
  });

  it('returns 500 when the internal secret is not configured', async () => {
    mockGetInternalApiSecret.mockReturnValue(undefined);

    const res = await GET(request('iphone-15', `Bearer ${SECRET}`), context());

    expect(res.status).toBe(500);
    expect(mockGetMerchantSafe).not.toHaveBeenCalled();
  });

  it('fails open when the slug query param is missing', async () => {
    const res = await GET(request(null, `Bearer ${SECRET}`), context());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(FAIL_OPEN);
    expect(mockGetMerchantSafe).not.toHaveBeenCalled();
  });

  it('fails open when the identifier is blank', async () => {
    const res = await GET(
      request('iphone-15', `Bearer ${SECRET}`),
      context('   ')
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(FAIL_OPEN);
    expect(mockGetMerchantSafe).not.toHaveBeenCalled();
  });

  it('fails open when the merchant does not resolve', async () => {
    mockGetMerchantSafe.mockResolvedValue(null);

    const res = await GET(
      request('iphone-15', `Bearer ${SECRET}`),
      context('unknown-store')
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(FAIL_OPEN);
    expect(mockGetCachedStorefrontProductSlugSet).not.toHaveBeenCalled();
  });

  it('fails open when the merchant is unpublished (coming-soon store)', async () => {
    mockGetMerchantSafe.mockResolvedValue({
      id: MERCHANT_ID,
      is_published: false,
    });

    const res = await GET(request('iphone-15', `Bearer ${SECRET}`), context());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(FAIL_OPEN);
    expect(mockGetCachedStorefrontProductSlugSet).not.toHaveBeenCalled();
  });

  it('fails open when the slug-set builder errors', async () => {
    mockGetCachedStorefrontProductSlugSet.mockResolvedValue({
      hasError: true,
      slugs: [],
    });

    const res = await GET(request('iphone-15', `Bearer ${SECRET}`), context());

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual(FAIL_OPEN);
  });

  it('fails open when the slug set is empty (cannot prove absence — e.g. stale zero-product cache)', async () => {
    mockGetCachedStorefrontProductSlugSet.mockResolvedValue({
      hasError: false,
      slugs: [],
    });

    const res = await GET(request('iphone-15', `Bearer ${SECRET}`), context());

    // An empty set must NOT 404 — it may be a stale set cached while the catalog
    // had zero products, so a merchant's first live product would be de-indexed.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(FAIL_OPEN);
  });
});
