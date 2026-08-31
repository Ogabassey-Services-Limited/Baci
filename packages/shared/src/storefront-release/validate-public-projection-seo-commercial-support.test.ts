import { describe, expect, it } from 'vitest';
import { hasEligibleCommercialSupportPath } from './validate-public-projection-seo-commercial-support';

const category = { id: 'category-1', slug: 'smartphones' };
const products = Array.from({ length: 5 }, (_, index) => ({
  available: true,
  brand: 'Samsung',
  categoryIds: [category.id],
  name: `Samsung Galaxy S${index + 20}`,
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
});
