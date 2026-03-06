import { beforeEach, describe, expect, it, vi } from 'vitest';

const headersMock = vi.fn();
const getCachedMerchantMock = vi.fn();
const getCachedMerchantByDomainMock = vi.fn();
const getCachedProductWithDetailsMock = vi.fn();
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
  getCachedProductWithDetails: getCachedProductWithDetailsMock,
}));

vi.mock('../../resolve-legacy-product-target', () => ({
  resolveLegacyProductTarget: resolveLegacyProductTargetMock,
}));

describe('category product metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    headersMock.mockResolvedValue(new Headers([['host', 'ogabassey.com']]));
    getCachedMerchantMock.mockResolvedValue(null);
    getCachedMerchantByDomainMock.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Ogabassey',
    });
    getCachedProductWithDetailsMock.mockResolvedValue(null);
    resolveLegacyProductTargetMock.mockResolvedValue(null);
  });

  it('self-canonicalizes missing category products on the current store host', async () => {
    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        category: 'smartphones',
        productSlug: 'apple-airpods-pro',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/smartphones/apple-airpods-pro'
    );
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it('self-canonicalizes legacy /product/* misses on the current store host', async () => {
    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        category: 'product',
        productSlug: 'ipad-11',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/product/ipad-11'
    );
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it('canonicalizes legacy archived slugs to the active product URL', async () => {
    resolveLegacyProductTargetMock.mockResolvedValue(
      '/smartphones/iphone-15-pro'
    );

    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        category: 'smartphones',
        productSlug: 'iphone-15-pro-8gb-128gb',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/smartphones/iphone-15-pro'
    );
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });
});
