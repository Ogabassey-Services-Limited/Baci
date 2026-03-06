import { beforeEach, describe, expect, it, vi } from 'vitest';

const headersMock = vi.fn();
const getCachedMerchantMock = vi.fn();
const getCachedMerchantByDomainMock = vi.fn();
const getCachedProductMock = vi.fn();
const resolveLegacyProductTargetMock = vi.fn();

vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: getCachedMerchantMock,
  getCachedMerchantByDomain: getCachedMerchantByDomainMock,
  getCachedProduct: getCachedProductMock,
  getCachedProductRatingStats: vi.fn(),
  getCachedProductReviews: vi.fn(),
}));

vi.mock('../../resolve-legacy-product-target', () => ({
  resolveLegacyProductTarget: resolveLegacyProductTargetMock,
}));

describe('legacy /products metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    headersMock.mockResolvedValue(new Headers([['host', 'ogabassey.com']]));
    getCachedMerchantMock.mockResolvedValue(null);
    getCachedMerchantByDomainMock.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Ogabassey',
    });
    getCachedProductMock.mockResolvedValue(null);
    resolveLegacyProductTargetMock.mockResolvedValue(null);
  });

  it('self-canonicalizes missing product slugs on the current store host', async () => {
    const { generateMetadata } = await import('./page');
    const parentMetadata = Promise.resolve({}) as Parameters<
      typeof generateMetadata
    >[1];

    const metadata = await generateMetadata(
      {
        params: Promise.resolve({
          slug: 'ogabassey.com',
          productSlug: 'ipad-11',
        }),
        searchParams: Promise.resolve({}),
      },
      parentMetadata
    );

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/products/ipad-11'
    );
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it('canonicalizes archived product slugs to the active replacement URL', async () => {
    resolveLegacyProductTargetMock.mockResolvedValue(
      '/smartphones/iphone-15-pro'
    );

    const { generateMetadata } = await import('./page');
    const parentMetadata = Promise.resolve({}) as Parameters<
      typeof generateMetadata
    >[1];

    const metadata = await generateMetadata(
      {
        params: Promise.resolve({
          slug: 'ogabassey.com',
          productSlug: 'iphone-15-pro-8gb-128gb',
        }),
        searchParams: Promise.resolve({}),
      },
      parentMetadata
    );

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/smartphones/iphone-15-pro'
    );
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });
});
