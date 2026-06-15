import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetInternalApiSecret = vi.fn();
const mockGetMerchantSafe = vi.fn();
const mockGetCachedStorefrontProductSlugSet = vi.fn();

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
  });

  it('returns present:true when the slug exists for the merchant', async () => {
    const res = await GET(request('iphone-15', `Bearer ${SECRET}`), context());

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ hasError: false, present: true });
    expect(mockGetMerchantSafe).toHaveBeenCalledWith(IDENTIFIER);
    expect(mockGetCachedStorefrontProductSlugSet).toHaveBeenCalledWith(
      MERCHANT_ID
    );
  });

  it('returns present:false when the slug is absent from the merchant set', async () => {
    const res = await GET(
      request('nonexistent-product', `Bearer ${SECRET}`),
      context()
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hasError: false, present: false });
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
