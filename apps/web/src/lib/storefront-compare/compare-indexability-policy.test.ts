import { describe, expect, it } from 'vitest';
import {
  buildApprovedCompareSlugsForCategory,
  buildCuratedCompareSlugSet,
  isCuratedCompareSlug,
} from './compare-indexability-policy';

const products = [
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
    slug: 'iphone-17-pro-max',
    name: 'iPhone 17 Pro Max',
    brand: 'Apple',
    price: 2_200_000,
    category_slug: 'smartphones',
    product_key_specs: {
      chipset: 'A19 Pro',
      ram_gb: 8,
      storage_gb: 256,
    },
  },
  {
    slug: 'galaxy-a56',
    name: 'Galaxy A56',
    brand: 'Samsung',
    price: 480_000,
    category_slug: 'smartphones',
    product_key_specs: {
      chipset: 'Exynos',
      ram_gb: 8,
      storage_gb: 128,
    },
  },
  {
    slug: 'galaxy-a36',
    name: 'Galaxy A36',
    brand: 'Samsung',
    price: 360_000,
    category_slug: 'smartphones',
    product_key_specs: {
      chipset: 'Snapdragon 7 Gen',
      ram_gb: 8,
      storage_gb: 128,
    },
  },
  {
    slug: 'iphone-16e',
    name: 'iPhone 16e',
    brand: 'Apple',
    price: 495_000,
    category_slug: 'smartphones',
    product_key_specs: {
      chipset: 'A18',
      ram_gb: 8,
      storage_gb: 128,
    },
  },
  {
    slug: 'iphone-15',
    name: 'iPhone 15',
    brand: 'Apple',
    price: 650_000,
    category_slug: 'smartphones',
    product_key_specs: {
      chipset: 'A17',
      ram_gb: 8,
      storage_gb: 128,
    },
  },
] as const;

describe('compare indexability policy', () => {
  it('builds a canonical allow-list from commercial category and product links', () => {
    const slugs = buildApprovedCompareSlugsForCategory({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products: [...products],
    });

    expect(slugs).toEqual(
      expect.arrayContaining([
        'apple-vs-samsung',
        'iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
      ])
    );
  });

  it('accepts reverse-order requests only when their canonical compare slug is curated', () => {
    const curatedSlugs = buildCuratedCompareSlugSet({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products: [...products],
    });

    expect(
      isCuratedCompareSlug(
        'samsung-galaxy-z-trifold-vs-iphone-17-pro-max',
        curatedSlugs
      )
    ).toBe(true);
    expect(isCuratedCompareSlug('iphone-15-vs-galaxy-a36', curatedSlugs)).toBe(
      false
    );
  });

  it('treats required eligible deep product pairs as curated', () => {
    const deepProducts = Array.from({ length: 152 }, (_, index) => ({
      slug: `phone-${index}`,
      name: `Phone ${index}`,
      brand: `Brand ${index % 4}`,
      price: 300_000 + index,
      category_slug: 'smartphones',
      product_key_specs: {
        chipset: `Chip ${index}`,
        ram_gb: 8 + index,
        storage_gb: 128 + index,
      },
    }));
    const left = deepProducts[150];
    const right = deepProducts[151];
    const curatedSlugs = buildCuratedCompareSlugSet({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products: deepProducts,
      requiredProductSlugs: [left.slug, right.slug],
    });

    expect(
      isCuratedCompareSlug(`${left.slug}-vs-${right.slug}`, curatedSlugs)
    ).toBe(true);
  });
});
