import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedProductSemanticInventory } from '@/lib/storefront-product/get-cached-product-semantic-inventory';
import {
  buildRelatedCompareLinks,
  dedupeCompareLinks,
  includeClickedCompareProducts,
  loadCompareGraphProducts,
} from './compare-page-link-helpers';

vi.mock(
  '@/lib/storefront-product/get-cached-product-semantic-inventory',
  () => ({
    getCachedProductSemanticInventory: vi.fn(),
  })
);

const mockedInventory = vi.mocked(getCachedProductSemanticInventory);

const products = [
  {
    slug: 'iphone-17-pro-max',
    name: 'iPhone 17 Pro Max',
    brand: 'Apple',
    price: 1_800_000,
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
    price: 2_300_000,
    category_slug: 'smartphones',
    product_key_specs: {
      chipset: 'Snapdragon 8 Elite',
      ram_gb: 16,
      storage_gb: 512,
    },
  },
  {
    slug: 'google-pixel-8',
    name: 'Google Pixel 8',
    brand: 'Google',
    price: 620_000,
    category_slug: 'smartphones',
    product_key_specs: {
      chipset: 'Tensor G3',
      ram_gb: 12,
      storage_gb: 128,
    },
  },
];

describe('compare page link helpers', () => {
  beforeEach(() => {
    mockedInventory.mockReset();
  });

  it('loads compare graph products from bounded semantic inventory', async () => {
    mockedInventory.mockResolvedValueOnce(products);

    await expect(
      loadCompareGraphProducts({
        categorySlug: 'smartphones',
        merchantId: 'merchant-1',
      })
    ).resolves.toEqual({ failed: false, products });
    expect(mockedInventory).toHaveBeenCalledWith('merchant-1', 'smartphones');
  });

  it('falls back to an empty failed inventory when compare graph loading fails', async () => {
    const consoleSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    mockedInventory.mockRejectedValueOnce(new Error('inventory failed'));

    await expect(
      loadCompareGraphProducts({
        categorySlug: 'smartphones',
        merchantId: 'merchant-1',
      })
    ).resolves.toEqual({ failed: true, products: [] });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('adds clicked compare products that are missing from bounded inventory', () => {
    expect(
      includeClickedCompareProducts({
        products: [products[0]],
        clickedProducts: [products[0], products[1]],
      }).map((product) => product.slug)
    ).toEqual(['iphone-17-pro-max', 'samsung-galaxy-z-trifold']);
  });

  it('builds related links from the provided route-approved product set', () => {
    expect(
      buildRelatedCompareLinks({
        storeUrl: 'https://ogabassey.com',
        categorySlug: 'smartphones',
        categoryName: 'Smartphones',
        products,
        leftProductSlug: 'iphone-17-pro-max',
        rightProductSlug: 'samsung-galaxy-z-trifold',
        currentComparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
      }).map((link) => link.comparisonSlug)
    ).toContain('google-pixel-8-vs-iphone-17-pro-max');
  });

  it('dedupes compare links by href while keeping the first copy', () => {
    const links = buildRelatedCompareLinks({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products,
      leftProductSlug: 'iphone-17-pro-max',
      rightProductSlug: 'samsung-galaxy-z-trifold',
      currentComparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
    });
    const duplicate = { ...links[0], label: 'Duplicate label' };

    expect(dedupeCompareLinks([links[0], duplicate, links[1]])).toEqual([
      links[0],
      links[1],
    ]);
  });
});
