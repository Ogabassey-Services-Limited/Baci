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

  it('builds canonical and social metadata for active category products', async () => {
    getCachedMerchantByDomainMock.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Ogabassey',
      custom_domain: 'ogabassey.com',
    });
    getCachedProductWithDetailsMock.mockResolvedValue({
      id: 'product-1',
      name: 'iPhone 15 Pro',
      slug: 'iphone-15-pro',
      description: 'Flagship iPhone with titanium design.',
      meta_title: 'iPhone 15 Pro at Ogabassey',
      meta_description: 'Buy the iPhone 15 Pro with fast delivery in Nigeria.',
      keywords: ['iphone', 'apple', 'smartphone'],
      image: 'https://cdn.ogabassey.com/products/iphone-15-pro.jpg',
      imageLarge: 'https://cdn.ogabassey.com/products/iphone-15-pro-large.jpg',
      images: [
        {
          url: 'https://cdn.ogabassey.com/products/iphone-15-pro-front.jpg',
          alt: 'iPhone 15 Pro front view',
        },
      ],
      category: 'Smartphones',
      condition: 'new',
      canonical_url: null,
      product_offers: [],
      product_variants: [],
      categories: {
        id: 'category-1',
        name: 'Smartphones',
        slug: 'smartphones',
      },
    });

    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        category: 'smartphones',
        productSlug: 'iphone-15-pro',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/smartphones/iphone-15-pro'
    );
    expect(metadata.openGraph).toMatchObject({
      title: 'iPhone 15 Pro at Ogabassey',
      description: 'Buy the iPhone 15 Pro with fast delivery in Nigeria.',
      url: 'https://ogabassey.com/smartphones/iphone-15-pro',
    });
    expect(metadata.openGraph?.images).toStrictEqual([
      {
        url: 'https://cdn.ogabassey.com/products/iphone-15-pro-front.jpg',
        alt: 'iPhone 15 Pro front view',
      },
    ]);
    expect(metadata.twitter).toMatchObject({
      title: 'iPhone 15 Pro at Ogabassey',
      description: 'Buy the iPhone 15 Pro with fast delivery in Nigeria.',
      images: ['https://cdn.ogabassey.com/products/iphone-15-pro-large.jpg'],
    });
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
