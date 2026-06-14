import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetInternalApiSecret = vi.fn();
const mockGetMerchantByIdentifier = vi.fn();
const mockGetCachedStorefrontProductSlugSet = vi.fn();

vi.mock('@/env', () => ({
  getInternalApiSecret: () => mockGetInternalApiSecret(),
}));
vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
}));
vi.mock('@/lib/cached-storefront-product-slug-set', () => ({
  getCachedStorefrontProductSlugSet: (...args: unknown[]) =>
    mockGetCachedStorefrontProductSlugSet(...args),
}));

import { GET } from './route';

const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
const IDENTIFIER = 'ogabassey.com';
const SECRET = 'test-internal-secret';

function request(authHeader?: string): NextRequest {
  return new NextRequest(
    `https://ogabassey.com/api/internal/slug-set/${IDENTIFIER}`,
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
    mockGetMerchantByIdentifier.mockResolvedValue({ id: MERCHANT_ID });
    mockGetCachedStorefrontProductSlugSet.mockResolvedValue({
      hasError: false,
      slugs: ['iphone-15', 'macbook-air-m1'],
    });
  });

  it('resolves the identifier to a merchant and returns its slug set', async () => {
    const res = await GET(request(`Bearer ${SECRET}`), context());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      hasError: false,
      slugs: ['iphone-15', 'macbook-air-m1'],
    });
    expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith(IDENTIFIER);
    expect(mockGetCachedStorefrontProductSlugSet).toHaveBeenCalledWith(
      MERCHANT_ID
    );
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const res = await GET(request(), context());

    expect(res.status).toBe(401);
    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer token does not match', async () => {
    const res = await GET(request('Bearer wrong-secret'), context());

    expect(res.status).toBe(401);
    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalled();
  });

  it('returns 500 when the internal secret is not configured', async () => {
    mockGetInternalApiSecret.mockReturnValue(undefined);

    const res = await GET(request(`Bearer ${SECRET}`), context());

    expect(res.status).toBe(500);
    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalled();
  });

  it('fails open (200 + empty set) when the merchant does not resolve', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue(null);

    const res = await GET(
      request(`Bearer ${SECRET}`),
      context('unknown-store')
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hasError: true, slugs: [] });
    expect(mockGetCachedStorefrontProductSlugSet).not.toHaveBeenCalled();
  });

  it('still returns 200 with the fail-open empty set when the builder errors', async () => {
    mockGetCachedStorefrontProductSlugSet.mockResolvedValue({
      hasError: true,
      slugs: [],
    });

    const res = await GET(request(`Bearer ${SECRET}`), context());

    // The proxy fails open on hasError; the route surfaces it as a 200 body so
    // the proxy's own fetch does not treat it as a transport failure.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hasError: true, slugs: [] });
  });
});
