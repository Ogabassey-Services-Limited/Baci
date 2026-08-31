import { describe, expect, it } from 'vitest';
import { hasEligibleCommercialSupportPath } from './validate-public-projection-seo-commercial-support';

const category = { id: 'category-1', slug: 'smartphones' };
const products = Array.from({ length: 5 }, (_, index) => ({
  available: true,
  brand: 'Samsung',
  categoryIds: [category.id],
  name: `Samsung Galaxy S${index + 20}`,
  priceMinor: 100_000 + index,
  primaryCategoryId: null,
  productKeySpecs: {
    camera_mp: 12 + index,
    display_inches: 6 + index / 10,
    storage_gb: 128 + index * 128,
  },
  slug: `galaxy-s${index + 20}`,
}));

describe('hasEligibleCommercialSupportPath', () => {
  it('requires qualified projected inventory for brand and family pages', () => {
    const categories = new Map([[category.slug, category]]);

    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/brands/samsung',
        categories,
        products
      )
    ).toBe(true);
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/brands/samsung/families/galaxy-s',
        categories,
        products
      )
    ).toBe(true);
  });

  it('requires in-stock projected products for brand routes', () => {
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/brands/samsung',
        new Map([[category.slug, category]]),
        products.map((product) => ({ ...product, available: false }))
      )
    ).toBe(false);
  });

  it('accepts a comparison only when both projected products resolve', () => {
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/compare/galaxy-s20-vs-galaxy-s21',
        new Map([[category.slug, category]]),
        products,
        {
          maintainedComparePaths: new Set([
            '/smartphones/compare/galaxy-s20-vs-galaxy-s21',
          ]),
        }
      )
    ).toBe(true);
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/compare/galaxy-s20-vs-missing',
        new Map([[category.slug, category]]),
        products
      )
    ).toBe(false);
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/compare/galaxy-s20-vs-galaxy-s21',
        new Map([[category.slug, category]]),
        products.map((product) => ({ ...product, available: false })),
        {
          maintainedComparePaths: new Set([
            '/smartphones/compare/galaxy-s20-vs-galaxy-s21',
          ]),
        }
      )
    ).toBe(true);
  });

  it('accepts curated price bands only with enough affordable products and brands', () => {
    const categories = new Map([[category.slug, category]]);
    const priceBandProducts = Array.from({ length: 6 }, (_, index) => ({
      ...products[index % products.length],
      brand: ['Samsung', 'Apple', 'Google'][index % 3],
      priceMinor: 400_000 + index,
      slug: `price-band-${index}`,
    }));

    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/best-under/under-500k',
        categories,
        priceBandProducts
      )
    ).toBe(true);
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/best-under/under-500k',
        categories,
        priceBandProducts.slice(0, 5)
      )
    ).toBe(false);
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/best-under/under-500k',
        categories,
        priceBandProducts.map((product) => ({ ...product, available: false }))
      )
    ).toBe(true);
  });

  it('compares curated price bands in minor units', () => {
    const categories = new Map([[category.slug, category]]);
    const bandProducts = Array.from({ length: 6 }, (_, index) => ({
      ...products[index % products.length],
      brand: ['Samsung', 'Apple', 'Google'][index % 3],
      priceMinor: 49_999_999,
      slug: `minor-band-${index}`,
    }));

    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/best-under/under-500k',
        categories,
        bandProducts
      )
    ).toBe(true);
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/best-under/under-500k',
        categories,
        bandProducts.map((product) => ({ ...product, priceMinor: 50_000_001 }))
      )
    ).toBe(false);
  });

  it('uses origin slug normalization for price-band brand counts', () => {
    const categories = new Map([[category.slug, category]]);
    const bandProducts = Array.from({ length: 6 }, (_, index) => ({
      ...products[index % products.length],
      brand: ['A.B', 'AB', 'C'][index % 3],
      priceMinor: 400_000 + index,
      slug: `normalized-brand-band-${index}`,
    }));

    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/best-under/under-500k',
        categories,
        bandProducts
      )
    ).toBe(false);
  });

  it('uses the merchant currency exponent for price-band ceilings', () => {
    const categories = new Map([[category.slug, category]]);
    const productsAtCeiling = Array.from({ length: 6 }, (_, index) => ({
      ...products[index % products.length],
      brand: ['Samsung', 'Apple', 'Google'][index % 3],
      priceMinor: 500_001,
      slug: `currency-band-${index}`,
    }));

    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/best-under/under-500k',
        categories,
        productsAtCeiling,
        { currency: 'JPY' }
      )
    ).toBe(false);
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/best-under/under-500k',
        categories,
        productsAtCeiling,
        { currency: 'NGN' }
      )
    ).toBe(true);
  });

  it('filters brand authority before applying the bounded inventory window', () => {
    const outsideWindow = Array.from({ length: 5 }, (_, index) => ({
      ...products[0],
      brand: 'Samsung',
      slug: `outside-window-${index}`,
    }));
    const newestWindow = Array.from({ length: 48 }, (_, index) => ({
      ...products[0],
      brand: 'Other',
      slug: `newest-window-${index}`,
    }));

    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/brands/samsung',
        new Map([[category.slug, category]]),
        [...newestWindow, ...outsideWindow]
      )
    ).toBe(true);
  });

  it('filters unavailable authority products before the bounded window', () => {
    const unavailableNewest = Array.from({ length: 46 }, (_, index) => ({
      ...products[0],
      available: false,
      id: `unavailable-newest-${index}`,
      slug: `unavailable-newest-${index}`,
      updatedAt: `2026-08-31T00:00:${String(index).padStart(2, '0')}Z`,
    }));
    const availableWindow = Array.from({ length: 2 }, (_, index) => ({
      ...products[index],
      id: `available-window-${index}`,
      slug: `available-window-${index}`,
      updatedAt: `2026-08-30T00:00:0${index}Z`,
    }));
    const olderAvailable = Array.from({ length: 3 }, (_, index) => ({
      ...products[index % products.length],
      id: `available-older-${index}`,
      slug: `available-older-${index}`,
      updatedAt: `2026-08-29T00:00:0${index}Z`,
    }));

    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/brands/samsung',
        new Map([[category.slug, category]]),
        [...unavailableNewest, ...availableWindow, ...olderAvailable]
      )
    ).toBe(true);
  });

  it('requires canonical brand route keys instead of aliases', () => {
    const categories = new Map([[category.slug, category]]);
    const xiaomiProducts = products.map((product) => ({
      ...product,
      brand: 'Redmi',
    }));

    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/brands/redmi',
        categories,
        xiaomiProducts
      )
    ).toBe(false);
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/brands/xiaomi',
        categories,
        [...xiaomiProducts, ...xiaomiProducts]
      )
    ).toBe(true);

    const googlePixelProducts = products.map((product) => ({
      ...product,
      brand: 'Google Pixel',
    }));
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/brands/google',
        categories,
        googlePixelProducts
      )
    ).toBe(false);
  });

  it('requires the canonical ordering and escaping of compare slugs', () => {
    const categories = new Map([[category.slug, category]]);
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/compare/galaxy-s21-vs-galaxy-s20',
        categories,
        products
      )
    ).toBe(false);
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/compare/~67616c6178792d733230-vs-galaxy-s21',
        categories,
        products
      )
    ).toBe(false);
  });

  it('decodes escaped compare product keys before resolving products', () => {
    const categories = new Map([[category.slug, category]]);
    const compareProducts = [
      {
        ...products[0],
        productKeySpecs: { camera: 12, storage: 128, screen: 6 },
        slug: 'iphone-15-vs-pro',
      },
      {
        ...products[1],
        productKeySpecs: { camera: 48, storage: 256, screen: 6.7 },
        slug: 'pixel-9',
      },
    ];

    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/compare/~6970686f6e652d31352d76732d70726f-vs-pixel-9',
        categories,
        compareProducts,
        {
          maintainedComparePaths: new Set([
            '/smartphones/compare/~6970686f6e652d31352d76732d70726f-vs-pixel-9',
          ]),
        }
      )
    ).toBe(true);
  });
});
