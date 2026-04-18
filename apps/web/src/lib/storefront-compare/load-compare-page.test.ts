import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadComparePage } from './load-compare-page';

const mockGetCachedMerchant = vi.fn();
const mockGetCachedCategoryPageData = vi.fn();
const mockGetCachedProductWithDetails = vi.fn();
const mockGetCachedFeatureSettings = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: (...args: unknown[]) => mockGetCachedMerchant(...args),
  getCachedCategoryPageData: (...args: unknown[]) =>
    mockGetCachedCategoryPageData(...args),
  getCachedProductWithDetails: (...args: unknown[]) =>
    mockGetCachedProductWithDetails(...args),
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
      id: 'product-a',
      slug: 'iphone-17-pro-max',
      name: 'iPhone 17 Pro Max',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Apple',
      price: 2_200_000,
    },
    {
      id: 'product-b',
      slug: 'samsung-galaxy-z-trifold',
      name: 'Samsung Galaxy Z TriFold',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 2_300_000,
    },
    {
      id: 'product-c',
      slug: 'galaxy-a56',
      name: 'Galaxy A56',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 480_000,
    },
    {
      id: 'product-d',
      slug: 'iphone-16e',
      name: 'iPhone 16e',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Apple',
      price: 495_000,
    },
    {
      id: 'product-e',
      slug: 'iphone-15',
      name: 'iPhone 15',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Apple',
      price: 650_000,
    },
    {
      id: 'product-f',
      slug: 'iphone-se',
      name: 'iPhone SE',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Apple',
      price: 550_000,
    },
    {
      id: 'product-g',
      slug: 'galaxy-s24-fe',
      name: 'Galaxy S24 FE',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 700_000,
    },
    {
      id: 'product-h',
      slug: 'galaxy-a36',
      name: 'Galaxy A36',
      category: 'Smartphones',
      category_slug: 'smartphones',
      brand: 'Samsung',
      price: 360_000,
    },
  ],
};

describe('loadComparePage', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    mockGetCachedMerchant.mockReset();
    mockGetCachedCategoryPageData.mockReset();
    mockGetCachedProductWithDetails.mockReset();
    mockGetCachedFeatureSettings.mockReset();
    mockGetCachedMerchant.mockResolvedValue(merchant);
    mockGetCachedCategoryPageData.mockResolvedValue(categoryPageData);
    mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: false });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a canonical product-vs-product page model for eligible products', async () => {
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[0],
      product_key_specs: { chipset: 'A19 Pro', ram_gb: 8, storage_gb: 256 },
    });
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categoryPageData.products[1],
      product_key_specs: {
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 16,
        storage_gb: 512,
      },
    });

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });

    expect(result?.kind).toBe('product');
    expect(result?.canonicalSlug).toBe(
      'iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
    expect(result?.canonicalUrl).toBe(
      'http://localhost:3000/ogabassey/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
    expect(result?.metaTitle).toContain(
      'iPhone 17 Pro Max vs Samsung Galaxy Z TriFold'
    );
    expect(result?.comparisonRows[0]).toMatchObject({
      label: expect.any(String),
      leftValue: expect.any(String),
      rightValue: expect.any(String),
    });
    expect(result?.breadcrumbItems.at(-1)?.url).toBe(result?.canonicalUrl);
  });

  it('returns a canonical brand-vs-brand page model when both brands pass thresholds', async () => {
    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'apple-vs-samsung',
    });

    expect(result?.kind).toBe('brand');
    expect(result?.canonicalSlug).toBe('apple-vs-samsung');
    expect(result?.heading).toBe('Apple vs Samsung Smartphones');
    expect(result?.summaryVerdict).toMatch(/smartphones shoppers/i);
    expect(result?.faqItems.length).toBeGreaterThan(0);
    expect(result?.comparisonRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Active models' }),
      ])
    );
  });

  it('keeps product compare pages indexable when detail payloads omit key specs but still expose rich spec rows', async () => {
    const leftDetail = {
      ...categoryPageData.products[0],
      specs: [
        { label: 'Processor', value: 'A19 Pro' },
        { label: 'RAM', value: '8GB' },
        { label: 'Storage', value: '256GB' },
      ],
    };
    const rightDetail = {
      ...categoryPageData.products[1],
      specs: [
        { label: 'Processor', value: 'Snapdragon 8 Elite' },
        { label: 'RAM', value: '16GB' },
        { label: 'Storage', value: '512GB' },
      ],
    };

    mockGetCachedProductWithDetails.mockResolvedValueOnce(leftDetail);
    mockGetCachedProductWithDetails.mockResolvedValueOnce(rightDetail);

    const result = await loadComparePage({
      merchantSlug: 'ogabassey',
      categorySlug: 'smartphones',
      comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });

    expect(result?.kind).toBe('product');
    expect(result?.isIndexable).toBe(true);
    expect(result?.canonicalSlug).toBe(
      'iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
    expect(result?.canonicalUrl).toBe(
      'http://localhost:3000/ogabassey/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
  });
});
