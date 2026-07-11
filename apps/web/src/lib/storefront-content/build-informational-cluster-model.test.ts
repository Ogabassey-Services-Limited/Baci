import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCategoryScopedSemanticInventorySafely } from '@/lib/storefront-product/load-category-scoped-semantic-inventory-safely';
import { buildInformationalClusterModel } from './build-informational-cluster-model';

vi.mock(
  '@/lib/storefront-product/load-category-scoped-semantic-inventory-safely',
  () => ({ loadCategoryScopedSemanticInventorySafely: vi.fn() })
);

const mockLoadScopedInventory = vi.mocked(
  loadCategoryScopedSemanticInventorySafely
);

const smartphoneGuidePost = {
  slug: 'best-phones-in-nigeria',
  title: 'Best Phones in Nigeria for 2026',
  excerpt: 'Affordable Android and iPhone picks for buyers in Nigeria.',
  category: 'Smartphones',
  tags: ['budget', 'iphone', 'samsung'],
  keywords: ['android', 'battery', 'smartphones'],
  featured_image_url: null,
  published_at: '2026-04-10T09:00:00.000Z',
  reading_time_minutes: 6,
};

const smartphoneCategoryData = {
  merchant: {
    id: 'merchant-1',
    business_name: 'Ogabassey',
    slug: 'ogabassey',
  },
  category: {
    slug: 'smartphones',
    name: 'Smartphones',
  },
  products: [
    {
      slug: 'iphone-17-pro-max',
      name: 'iPhone 17 Pro Max',
      brand: 'Apple',
      price: 495_000,
      category_slug: 'smartphones',
      product_key_specs: {
        chipset: 'A19 Pro',
        ram_gb: 8,
        storage_gb: 256,
      },
    },
    {
      slug: 'samsung-galaxy-z-trifold',
      name: 'Samsung Galaxy Z TriFold',
      brand: 'Samsung',
      price: 480_000,
      category_slug: 'smartphones',
      product_key_specs: {
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 16,
        storage_gb: 512,
      },
    },
    {
      slug: 'galaxy-a56',
      name: 'Galaxy A56',
      brand: 'Samsung',
      price: 410_000,
      category_slug: 'smartphones',
      product_key_specs: {
        chipset: 'Exynos',
        ram_gb: 8,
        storage_gb: 128,
      },
    },
    {
      slug: 'iphone-15',
      name: 'iPhone 15',
      brand: 'Apple',
      price: 430_000,
      category_slug: 'smartphones',
      product_key_specs: {
        chipset: 'A17',
        ram_gb: 8,
        storage_gb: 128,
      },
    },
  ],
  isCollection: false,
};

describe('buildInformationalClusterModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds category, compare, price-band, and PDP links for a smartphone guide', async () => {
    const model = await buildInformationalClusterModel({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      storeUrl: 'https://ogabassey.com',
      post: smartphoneGuidePost,
      categoryDataOverride: smartphoneCategoryData,
    });

    expect(model?.primaryCategoryLink?.href).toBe(
      'https://ogabassey.com/smartphones'
    );
    expect(model?.commerceLinks.map((link) => link.href)).toContain(
      'https://ogabassey.com/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
    expect(model?.featuredProducts[0]?.href).toBe(
      'https://ogabassey.com/smartphones/galaxy-a56'
    );
  });

  it('formats featured product prices with the storefront country currency', async () => {
    const model = await buildInformationalClusterModel({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      storeUrl: 'https://ogabassey.com',
      post: smartphoneGuidePost,
      categoryDataOverride: smartphoneCategoryData,
      countryCode: 'IN',
    });

    expect(model?.featuredProducts[0]?.description).toMatch(/₹|INR/);
    expect(model?.featuredProducts[0]?.description).not.toContain('₦');
  });

  it('falls back to Nigerian currency for featured product prices', async () => {
    const defaultModel = await buildInformationalClusterModel({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      storeUrl: 'https://ogabassey.com',
      post: smartphoneGuidePost,
      categoryDataOverride: smartphoneCategoryData,
    });
    const explicitNigeriaModel = await buildInformationalClusterModel({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      storeUrl: 'https://ogabassey.com',
      post: smartphoneGuidePost,
      categoryDataOverride: smartphoneCategoryData,
      countryCode: 'NG',
    });

    expect(defaultModel?.featuredProducts[0]?.description).toContain('₦');
    expect(defaultModel?.featuredProducts[0]?.description).not.toMatch(/₹|INR/);
    expect(explicitNigeriaModel?.featuredProducts[0]?.description).toContain(
      '₦'
    );
    expect(explicitNigeriaModel?.featuredProducts[0]?.description).not.toMatch(
      /₹|INR/
    );
  });

  it('returns null when the article category cannot be inferred', async () => {
    const model = await buildInformationalClusterModel({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      storeUrl: 'https://ogabassey.com',
      post: {
        slug: 'store-update',
        title: 'Store update',
        excerpt: 'New features this week.',
        category: 'News',
        tags: ['update'],
        keywords: ['launch'],
        featured_image_url: null,
        published_at: '2026-04-10T09:00:00.000Z',
        reading_time_minutes: 2,
      },
      categoryDataOverride: smartphoneCategoryData,
    });

    expect(model).toBeNull();
  });

  it('builds the model from the scoped semantic inventory when no override is supplied', async () => {
    mockLoadScopedInventory.mockResolvedValue({
      isCollection: false,
      categoryName: 'Smartphones',
      products: [
        {
          slug: 'iphone-17-pro-max',
          name: 'iPhone 17 Pro Max',
          brand: 'Apple',
          price: 495_000,
          category_slug: 'smartphones',
          product_key_specs: { ram_gb: 8, storage_gb: 256 },
          condition: 'new',
          stock: 5,
        },
        {
          slug: 'galaxy-a56',
          name: 'Galaxy A56',
          brand: 'Samsung',
          price: 410_000,
          category_slug: 'smartphones',
          product_key_specs: { ram_gb: 8, storage_gb: 128 },
          condition: 'new',
          stock: 3,
        },
      ],
    });

    const model = await buildInformationalClusterModel({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      storeUrl: 'https://ogabassey.com',
      post: smartphoneGuidePost,
    });

    expect(mockLoadScopedInventory).toHaveBeenCalledWith(
      expect.objectContaining({
        categorySlug: 'smartphones',
        merchantId: 'merchant-1',
        storeSlug: 'ogabassey',
      })
    );
    expect(model?.primaryCategoryLink?.href).toBe(
      'https://ogabassey.com/smartphones'
    );
    // cheapest in-stock product surfaces first
    expect(model?.featuredProducts[0]?.href).toBe(
      'https://ogabassey.com/smartphones/galaxy-a56'
    );
  });

  it('applies toCategoryInventoryProduct fallbacks for missing fields on the scoped path', async () => {
    mockLoadScopedInventory.mockResolvedValue({
      isCollection: false,
      categoryName: 'Smartphones',
      products: [
        {
          // category_slug, product_key_specs, condition and stock all absent
          slug: 'mystery-phone',
          name: 'Mystery Phone',
          brand: 'NoName',
          price: 100_000,
        },
      ],
    });

    const model = await buildInformationalClusterModel({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      storeUrl: 'https://ogabassey.com',
      post: smartphoneGuidePost,
    });

    // category_slug falls back to the inferred category slug (not the
    // slugless /products/ href), and null stock is treated as in-stock so the
    // product is still featured — matching the old getCachedCategoryPageData
    // normalization the swap must preserve.
    expect(model?.featuredProducts).toHaveLength(1);
    expect(model?.featuredProducts[0]?.href).toBe(
      'https://ogabassey.com/smartphones/mystery-phone'
    );
  });

  it('returns null when the scoped inventory resolves to a collection', async () => {
    mockLoadScopedInventory.mockResolvedValue({
      isCollection: true,
      categoryName: 'Smartphones',
      products: [],
    });

    const model = await buildInformationalClusterModel({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      storeUrl: 'https://ogabassey.com',
      post: smartphoneGuidePost,
    });

    expect(model).toBeNull();
  });
});
