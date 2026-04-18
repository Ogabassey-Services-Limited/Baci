import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPriceBandPage } from './load-price-band-page';

const mockGetCachedMerchant = vi.fn();
const mockGetCachedCategoryPageData = vi.fn();
const mockGetCachedFeatureSettings = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: (...args: unknown[]) => mockGetCachedMerchant(...args),
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
    mockGetCachedMerchant.mockReset();
    mockGetCachedCategoryPageData.mockReset();
    mockGetCachedFeatureSettings.mockReset();
    mockGetCachedMerchant.mockResolvedValue(merchant);
    mockGetCachedCategoryPageData.mockResolvedValue(categoryPageData);
    mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: false });
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
    expect(result?.products).toHaveLength(6);
    expect(result?.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: 'iphone-16e',
          availability: 'OutOfStock',
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
});
