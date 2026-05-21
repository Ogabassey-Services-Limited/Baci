import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPriceBandPage } from './load-price-band-page';

const mockGetMerchantByIdentifier = vi.fn();
const mockGetCachedCategoryPageData = vi.fn();
const mockGetCachedFeatureSettings = vi.fn();
const mockHeaders = vi.fn();

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
  getCachedCategoryPageData: (...args: unknown[]) =>
    mockGetCachedCategoryPageData(...args),
  getCachedFeatureSettings: (...args: unknown[]) =>
    mockGetCachedFeatureSettings(...args),
}));

const merchant = {
  id: 'merchant-1',
  slug: 'ogabassey',
  business_name: 'Ogabassey',
  payout_currency: 'NGN',
};

const categoryPageData = {
  isCollection: false,
  fallbackName: 'Smartphones',
  products: [
    {
      id: 'product-c',
      slug: 'galaxy-a56',
      name: 'Galaxy A56',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 480_000,
      stock: 12,
      condition: 'Refurbished',
      images: ['https://cdn.example.com/a56.jpg'],
      description: '<p>Best <strong>midrange</strong> pick</p>',
    },
    {
      id: 'product-d',
      slug: 'iphone-16e',
      name: 'iPhone 16e',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Apple',
      price: 495_000,
      stock: 0,
      has_condition_offers: true,
      images: ['https://cdn.example.com/16e.jpg'],
    },
    {
      id: 'product-e',
      slug: 'redmi-note-14',
      name: 'Redmi Note 14',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Xiaomi',
      price: 650_000,
      images: ['https://cdn.example.com/redmi-note-14.jpg'],
    },
    {
      id: 'product-f',
      slug: 'tecno-camon-40',
      name: 'Tecno Camon 40',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Tecno',
      price: 550_000,
      images: ['https://cdn.example.com/tecno-camon-40.jpg'],
    },
    {
      id: 'product-g',
      slug: 'galaxy-s24-fe',
      name: 'Galaxy S24 FE',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 700_000,
      images: ['https://cdn.example.com/s24fe.jpg'],
    },
    {
      id: 'product-h',
      slug: 'galaxy-a36',
      name: 'Galaxy A36',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 360_000,
      images: ['https://cdn.example.com/a36.jpg'],
    },
  ],
};

describe('loadPriceBandPage', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    mockGetMerchantByIdentifier.mockReset();
    mockGetCachedCategoryPageData.mockReset();
    mockGetCachedFeatureSettings.mockReset();
    mockHeaders.mockReset();
    mockGetMerchantByIdentifier.mockResolvedValue(merchant);
    mockGetCachedCategoryPageData.mockResolvedValue(categoryPageData);
    mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: false });
    mockHeaders.mockResolvedValue(new Headers());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a canonical model for an eligible curated band', async () => {
    const result = await loadPriceBandPage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      priceBandSlug: 'under-1m',
    });

    expect(result?.isIndexable).toBe(true);
    expect(result?.canonicalUrl).toBe(
      'http://localhost:3000/ogabassey/smartphones/best-under/under-1m'
    );
    expect(result?.metaTitle).toBe(
      'Best Smartphones Under ₦1,000,000 in Nigeria | Ogabassey'
    );
    expect(result?.metaDescription).toContain(
      'Compare the best smartphones under ₦1,000,000 in Nigeria'
    );
    expect(result?.heading).toBe(
      'Best Smartphones Under ₦1,000,000 in Nigeria'
    );
    expect(result?.intro).toContain(
      'under ₦1,000,000 in Nigeria, based on live Ogabassey inventory'
    );
    expect(result?.products).toHaveLength(6);
    expect(result?.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: 'iphone-16e',
          availability: 'InStock',
          stock: 0,
          condition: 'New',
          has_condition_offers: true,
        }),
        expect.objectContaining({
          slug: 'galaxy-a56',
          condition: 'Refurbished',
          has_condition_offers: false,
        }),
      ])
    );
  });

  it('returns a non-indexable model when the curated band is below threshold', async () => {
    const result = await loadPriceBandPage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      priceBandSlug: 'under-500k',
    });

    expect(result?.isIndexable).toBe(false);
  });

  it('keeps the merchant slug path prefix for path-routed storefronts in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const result = await loadPriceBandPage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      priceBandSlug: 'under-1m',
    });

    expect(result?.pathPrefix).toBe('/ogabassey');
  });

  it('drops the path prefix for custom-domain storefront identifiers', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mockGetMerchantByIdentifier.mockResolvedValueOnce({
      ...merchant,
      custom_domain: 'ogabassey.com',
    });

    const result = await loadPriceBandPage({
      merchantSlug: 'ogabassey.com',
      categorySlug: 'smartphones',
      priceBandSlug: 'under-1m',
    });

    expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey.com');
    expect(result?.pathPrefix).toBe('');
  });

  it('drops the path prefix for subdomain storefront requests', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mockHeaders.mockResolvedValueOnce(
      new Headers([['x-merchant-slug', 'ogabassey']])
    );

    const result = await loadPriceBandPage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      priceBandSlug: 'under-1m',
    });

    expect(result?.pathPrefix).toBe('');
  });
});
