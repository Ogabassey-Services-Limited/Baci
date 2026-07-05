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
      },
      {
        id: 'cat-2',
        name: 'Draft',
        slug: 'draft',
        is_active: false,
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
      storeUrl: 'https://ogabassey.com',
    });
    expect(mockGetCachedProductSemanticInventory).toHaveBeenCalledWith(
      'merchant-1',
      'smartphones'
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
