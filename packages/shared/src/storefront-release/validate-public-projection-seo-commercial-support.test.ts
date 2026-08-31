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

  it('accepts a comparison only when both projected products resolve', () => {
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/compare/galaxy-s20-vs-galaxy-s21',
        new Map([[category.slug, category]]),
        products
      )
    ).toBe(true);
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/compare/galaxy-s20-vs-missing',
        new Map([[category.slug, category]]),
        products
      )
    ).toBe(false);
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
        compareProducts
      )
    ).toBe(true);
  });
});
