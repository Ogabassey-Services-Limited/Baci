import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetInternalApiSecret = vi.fn();
const mockGetMerchantSafe = vi.fn();
const mockGetCachedProductCanonicalRedirectTarget = vi.fn();
const mockGetCachedLegacyProductRedirectTarget = vi.fn();

vi.mock('@/env', () => ({
  getInternalApiSecret: () => mockGetInternalApiSecret(),
}));
vi.mock('@/lib/cached-data', () => ({
  getCachedLegacyProductRedirectTarget: (...args: unknown[]) =>
    mockGetCachedLegacyProductRedirectTarget(...args),
  getCachedProductCanonicalRedirectTarget: (...args: unknown[]) =>
    mockGetCachedProductCanonicalRedirectTarget(...args),
  getMerchantSafe: (...args: unknown[]) => mockGetMerchantSafe(...args),
}));

import { GET } from './route';

const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
const IDENTIFIER = 'ogabassey.com';
const SECRET = 'test-internal-secret';
const FAIL_OPEN = { hasError: true, redirectPath: null };

function request(
  params: { category?: string; slug?: string } = {},
  authHeader = `Bearer ${SECRET}`
): NextRequest {
  const url = new URL(
    `https://platform.test/api/internal/product-canonical/${IDENTIFIER}`
  );
  if (params.category !== undefined)
    url.searchParams.set('category', params.category);
  if (params.slug !== undefined) url.searchParams.set('slug', params.slug);
  return new NextRequest(url, { headers: { Authorization: authHeader } });
}

function context(identifier = IDENTIFIER) {
  return { params: Promise.resolve({ identifier }) };
}

describe('GET /api/internal/product-canonical/[identifier]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInternalApiSecret.mockReturnValue(SECRET);
    mockGetMerchantSafe.mockResolvedValue({
      id: MERCHANT_ID,
      is_published: true,
    });
    mockGetCachedProductCanonicalRedirectTarget.mockResolvedValue(null);
    mockGetCachedLegacyProductRedirectTarget.mockResolvedValue(null);
  });

  it('returns a redirect path when an active product is requested under the wrong category', async () => {
    mockGetCachedProductCanonicalRedirectTarget.mockResolvedValue({
      id: 'product-1',
      name: 'TECNO Spark 40',
      slug: 'tecno-spark-40',
      category: 'Smartphones',
      categories: { name: 'Smartphones', slug: 'smartphones' },
      status: 'active',
    });

    const res = await GET(
      request({ category: 'tecno', slug: 'tecno-spark-40' }),
      context()
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({
      hasError: false,
      redirectPath: '/smartphones/tecno-spark-40',
    });
    expect(mockGetCachedProductCanonicalRedirectTarget).toHaveBeenCalledWith(
      MERCHANT_ID,
      'tecno-spark-40'
    );
  });

  it('returns no redirect when the active product request already matches the canonical path', async () => {
    mockGetCachedProductCanonicalRedirectTarget.mockResolvedValue({
      id: 'product-1',
      name: 'TECNO Spark 40',
      slug: 'tecno-spark-40',
      category: 'Smartphones',
      categories: { name: 'Smartphones', slug: 'smartphones' },
      status: 'active',
    });

    const res = await GET(
      request({ category: 'smartphones', slug: 'tecno-spark-40' }),
      context()
    );

    expect(await res.json()).toEqual({ hasError: false, redirectPath: null });
  });

  it('ignores stale stored canonical_url values when the product fields already match', async () => {
    mockGetCachedProductCanonicalRedirectTarget.mockResolvedValue({
      canonical_url: '/products/pixel-10',
      id: 'product-1',
      name: 'Pixel 10',
      slug: 'pixel-10',
      category: 'Smartphones',
      categories: { name: 'Smartphones', slug: 'smartphones' },
      status: 'active',
    });

    const res = await GET(
      request({ category: 'smartphones', slug: 'pixel-10' }),
      context()
    );

    expect(await res.json()).toEqual({ hasError: false, redirectPath: null });
  });

  it('builds stale-category redirects from product fields instead of stale canonical_url', async () => {
    mockGetCachedProductCanonicalRedirectTarget.mockResolvedValue({
      canonical_url: '/products/pixel-10',
      id: 'product-1',
      name: 'Pixel 10',
      slug: 'pixel-10',
      category: 'Smartphones',
      categories: { name: 'Smartphones', slug: 'smartphones' },
      status: 'active',
    });

    const res = await GET(
      request({ category: 'google', slug: 'pixel-10' }),
      context()
    );

    expect(await res.json()).toEqual({
      hasError: false,
      redirectPath: '/smartphones/pixel-10',
    });
  });

  it('does not redirect normalized public category aliases back to legacy stored paths', async () => {
    mockGetCachedProductCanonicalRedirectTarget.mockResolvedValue({
      id: 'product-1',
      name: 'iPhone 12',
      slug: 'iphone-12',
      category: 'Phones',
      category_slug: 'phones',
      categories: { name: 'Phones', slug: 'phones' },
      status: 'active',
    });

    const res = await GET(
      request({ category: 'smartphones', slug: 'iphone-12' }),
      context()
    );

    expect(await res.json()).toEqual({ hasError: false, redirectPath: null });
  });

  it('returns the normalized public alias target for stale product category URLs', async () => {
    mockGetCachedProductCanonicalRedirectTarget.mockResolvedValue({
      id: 'product-1',
      name: 'iPhone 12',
      slug: 'iphone-12',
      category: 'Phones',
      category_slug: 'phones',
      categories: { name: 'Phones', slug: 'phones' },
      status: 'active',
    });

    const res = await GET(
      request({ category: 'tecno', slug: 'iphone-12' }),
      context()
    );

    expect(await res.json()).toEqual({
      hasError: false,
      redirectPath: '/smartphones/iphone-12',
    });
  });

  it('handles Supabase relationship arrays when building the canonical path', async () => {
    mockGetCachedProductCanonicalRedirectTarget.mockResolvedValue({
      id: 'product-1',
      name: 'iPhone 15',
      slug: 'iphone-15',
      category: 'Smartphones',
      categories: [{ name: 'Smartphones', slug: 'smartphones' }],
      status: 'active',
    });

    const res = await GET(
      request({ category: 'apple', slug: 'iphone-15' }),
      context()
    );

    expect(await res.json()).toEqual({
      hasError: false,
      redirectPath: '/smartphones/iphone-15',
    });
  });

  it('returns a redirect path for an archived child product with an active parent', async () => {
    mockGetCachedProductCanonicalRedirectTarget.mockResolvedValue({
      id: 'archived-child-1',
      name: 'Samsung Galaxy Z Fold6 12GB 256GB',
      slug: 'samsung-galaxy-z-fold-6-12gb-256gb',
      category: 'Smartphones',
      categories: { name: 'Smartphones', slug: 'smartphones' },
      status: 'archived',
    });
    mockGetCachedLegacyProductRedirectTarget.mockResolvedValue({
      id: 'parent-1',
      name: 'Samsung Galaxy Z Fold6',
      slug: 'samsung-galaxy-z-fold-6',
      category: 'Smartphones',
      categories: { name: 'Smartphones', slug: 'smartphones' },
    });

    const res = await GET(
      request({
        category: 'smartphones',
        slug: 'samsung-galaxy-z-fold-6-12gb-256gb',
      }),
      context()
    );

    expect(await res.json()).toEqual({
      hasError: false,
      redirectPath: '/smartphones/samsung-galaxy-z-fold-6',
    });
    expect(mockGetCachedLegacyProductRedirectTarget).toHaveBeenCalledWith(
      MERCHANT_ID,
      'samsung-galaxy-z-fold-6-12gb-256gb'
    );
  });

  it('fails open for invalid input or unresolved merchants', async () => {
    expect(
      await (await GET(request({ slug: 'iphone-15' }), context())).json()
    ).toEqual(FAIL_OPEN);

    mockGetMerchantSafe.mockResolvedValue(null);
    expect(
      await (
        await GET(request({ category: 'apple', slug: 'iphone-15' }), context())
      ).json()
    ).toEqual(FAIL_OPEN);
  });

  it('returns 401 when the bearer token is invalid', async () => {
    const res = await GET(
      request({ category: 'apple', slug: 'iphone-15' }, 'Bearer wrong'),
      context()
    );

    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(mockGetMerchantSafe).not.toHaveBeenCalled();
  });

  it('returns 500 when the internal API secret is not configured', async () => {
    mockGetInternalApiSecret.mockReturnValue('');

    const res = await GET(
      request({ category: 'apple', slug: 'iphone-15' }),
      context()
    );

    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    expect(mockGetMerchantSafe).not.toHaveBeenCalled();
  });
});
