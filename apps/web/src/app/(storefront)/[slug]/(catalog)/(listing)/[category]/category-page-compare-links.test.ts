import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedProductSemanticInventory } from '@/lib/storefront-product/get-cached-product-semantic-inventory';
import { loadCategoryPageCompareLinks } from './category-page-compare-links';

vi.mock(
  '@/lib/storefront-product/get-cached-product-semantic-inventory',
  () => ({
    getCachedProductSemanticInventory: vi.fn(),
  })
);

const mockedInventory = vi.mocked(getCachedProductSemanticInventory);

describe('loadCategoryPageCompareLinks', () => {
  beforeEach(() => {
    mockedInventory.mockReset();
  });

  it('loads category inventory and returns a category compare hub plus graph links', async () => {
    mockedInventory.mockResolvedValue([
      {
        slug: 'xiaomi-13t',
        name: 'Xiaomi 13T',
        brand: 'Xiaomi',
        category_slug: 'smartphones',
        price: 450_000,
        product_key_specs: {
          chipset: 'Dimensity 8200 Ultra',
          ram_gb: 12,
          storage_gb: 256,
        },
      },
      {
        slug: 'samsung-galaxy-s24-ultra',
        name: 'Samsung Galaxy S24 Ultra',
        brand: 'Samsung',
        category_slug: 'smartphones',
        price: 1_550_000,
        product_key_specs: {
          chipset: 'Snapdragon 8 Gen 3',
          ram_gb: 16,
          storage_gb: 512,
        },
      },
    ]);

    const links = await loadCategoryPageCompareLinks({
      storeUrl: 'https://ogabassey.com',
      merchantId: 'merchant-1',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
    });

    expect(mockedInventory).toHaveBeenCalledWith('merchant-1', 'smartphones');
    expect(links).toEqual(
      expect.arrayContaining([
        {
          href: 'https://ogabassey.com/smartphones/compare',
          label: 'View all smartphones comparisons',
        },
        {
          href: 'https://ogabassey.com/smartphones/compare/samsung-galaxy-s24-ultra-vs-xiaomi-13t',
          label: 'Compare Samsung Galaxy S24 Ultra with Xiaomi 13T',
        },
      ])
    );
  });

  it('returns no links when inventory loading fails', async () => {
    mockedInventory.mockRejectedValue(new Error('inventory unavailable'));

    await expect(
      loadCategoryPageCompareLinks({
        storeUrl: 'https://ogabassey.com',
        merchantId: 'merchant-1',
        categorySlug: 'smartphones',
        categoryName: 'Smartphones',
      })
    ).resolves.toEqual([]);
  });

  it('returns no links for empty or singleton category inventories', async () => {
    mockedInventory.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        slug: 'xiaomi-13t',
        name: 'Xiaomi 13T',
        brand: 'Xiaomi',
        category_slug: 'smartphones',
        price: 450_000,
        product_key_specs: {
          chipset: 'Dimensity 8200 Ultra',
          ram_gb: 12,
          storage_gb: 256,
        },
      },
    ]);

    const input = {
      storeUrl: 'https://ogabassey.com',
      merchantId: 'merchant-1',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
    };

    await expect(loadCategoryPageCompareLinks(input)).resolves.toEqual([]);
    await expect(loadCategoryPageCompareLinks(input)).resolves.toEqual([]);
  });
});
