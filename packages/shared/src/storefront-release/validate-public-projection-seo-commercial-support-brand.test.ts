import { describe, expect, it } from 'vitest';
import { hasEligibleCommercialSupportPath } from './validate-public-projection-seo-commercial-support';

const category = { id: 'category-1', slug: 'smartphones' };
const products = Array.from({ length: 5 }, (_, index) => ({
  available: true,
  brand: 'Samsung!',
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

describe('brand authority exact matching', () => {
  it('rejects punctuated brands that the origin exact query does not match', () => {
    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/brands/samsung',
        new Map([[category.slug, category]]),
        products
      )
    ).toBe(false);
  });
});
