import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCategoryCompareHubData } from './load-category-compare-hub-data';

const mockGetMerchantByIdentifier = vi.fn();
const mockGetCachedCategories = vi.fn();
const mockGetCachedProductSemanticInventory = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getCachedCategories: (...args: unknown[]) => mockGetCachedCategories(...args),
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: () => 'https://ogabassey.com',
}));

vi.mock(
  '@/lib/storefront-product/get-cached-product-semantic-inventory',
  () => ({
    getCachedProductSemanticInventory: (...args: unknown[]) =>
      mockGetCachedProductSemanticInventory(...args),
  })
);

describe('loadCategoryCompareHubData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      business_name: 'Ogabassey',
    });
    mockGetCachedCategories.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Smartphones',
        slug: 'smartphones',
        is_active: true,
        parent_id: null,
      },
      {
        id: 'cat-2',
        name: 'Draft',
        slug: 'draft',
        is_active: false,
        parent_id: null,
      },
    ]);
    mockGetCachedProductSemanticInventory.mockResolvedValue([
      {
        slug: 'xiaomi-13t',
        name: 'Xiaomi 13T',
        price: 450_000,
        category_slug: 'smartphones',
      },
    ]);
  });

  it('loads active category metadata and bounded semantic products', async () => {
    await expect(
      loadCategoryCompareHubData({
        merchantSlug: 'ogabassey',
        categorySlug: 'smartphones',
      })
    ).resolves.toMatchObject({
      categoryName: 'Smartphones',
      categorySlug: 'smartphones',
      products: [{ slug: 'xiaomi-13t' }],
      inventoryDegraded: false,
      storeUrl: 'https://ogabassey.com',
    });
    expect(mockGetCachedProductSemanticInventory).toHaveBeenCalledWith(
      'merchant-1',
      'smartphones'
    );
  });

  it('loads semantic inventory for active child categories in the hub scope', async () => {
    mockGetCachedCategories.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Laptops',
        slug: 'laptops',
        is_active: true,
        parent_id: null,
      },
      {
        id: 'cat-2',
        name: 'Business Laptops',
        slug: 'business-laptops',
        is_active: true,
        parent_id: 'cat-1',
      },
      {
        id: 'cat-3',
        name: 'Draft Laptops',
        slug: 'draft-laptops',
        is_active: false,
        parent_id: 'cat-1',
      },
      {
        id: 'cat-4',
        name: 'Imported Drafts',
        slug: 'imported-drafts',
        is_active: null,
        parent_id: 'cat-1',
      },
    ]);
    mockGetCachedProductSemanticInventory.mockImplementation(
      async (_merchantId: string, categorySlug: string) =>
        categorySlug === 'business-laptops'
          ? [
              {
                slug: 'thinkpad-x1-carbon-gen-7',
                name: 'Lenovo ThinkPad X1 Carbon Gen 7',
                price: 750_000,
                category_slug: 'business-laptops',
              },
            ]
          : [
              {
                slug: 'macbook-pro',
                name: 'MacBook Pro',
                price: 4_500_000,
                category_slug: 'laptops',
              },
            ]
    );

    await expect(
      loadCategoryCompareHubData({
        merchantSlug: 'ogabassey',
        categorySlug: 'laptops',
      })
    ).resolves.toMatchObject({
      productGroups: [
        {
          categoryName: 'Laptops',
          categorySlug: 'laptops',
          products: [{ slug: 'macbook-pro' }],
        },
        {
          categoryName: 'Business Laptops',
          categorySlug: 'business-laptops',
          products: [{ slug: 'thinkpad-x1-carbon-gen-7' }],
        },
      ],
      products: [{ slug: 'macbook-pro' }, { slug: 'thinkpad-x1-carbon-gen-7' }],
    });
    expect(mockGetCachedProductSemanticInventory).toHaveBeenCalledTimes(2);
    expect(mockGetCachedProductSemanticInventory).toHaveBeenCalledWith(
      'merchant-1',
      'business-laptops'
    );
    expect(mockGetCachedProductSemanticInventory).not.toHaveBeenCalledWith(
      'merchant-1',
      'draft-laptops'
    );
    expect(mockGetCachedProductSemanticInventory).not.toHaveBeenCalledWith(
      'merchant-1',
      'imported-drafts'
    );
  });

  it('returns an empty hub when semantic inventory loading fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Suppress expected warning noise for this server-side fallback path.
    });
    mockGetCachedProductSemanticInventory.mockRejectedValueOnce(
      new Error('inventory timeout')
    );

    await expect(
      loadCategoryCompareHubData({
        merchantSlug: 'ogabassey',
        categorySlug: 'smartphones',
      })
    ).resolves.toMatchObject({
      categoryName: 'Smartphones',
      categorySlug: 'smartphones',
      products: [],
      inventoryDegraded: true,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to load category compare hub inventory',
      expect.objectContaining({
        categorySlug: 'smartphones',
        merchantId: 'merchant-1',
      })
    );

    warnSpy.mockRestore();
  });

  it('rejects missing and inactive categories', async () => {
    await expect(
      loadCategoryCompareHubData({
        merchantSlug: 'ogabassey',
        categorySlug: 'missing',
      })
    ).resolves.toBeNull();
    await expect(
      loadCategoryCompareHubData({
        merchantSlug: 'ogabassey',
        categorySlug: 'draft',
      })
    ).resolves.toBeNull();
  });
});
