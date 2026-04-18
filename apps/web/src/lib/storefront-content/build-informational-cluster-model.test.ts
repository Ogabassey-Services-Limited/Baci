import { describe, expect, it } from 'vitest';
import { buildInformationalClusterModel } from './build-informational-cluster-model';

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
});
