import { describe, expect, it } from 'vitest';
import { curateProductComparePairs } from '@/lib/storefront-compare/curate-product-compare-pairs';

function product(slug: string, price: number) {
  return {
    slug,
    name: slug.replaceAll('-', ' '),
    brand: slug.split('-')[0],
    price,
    category_slug: 'smartphones',
    product_key_specs: {
      chipset: `${slug}-chip`,
      ram_gb: price,
      storage_gb: price * 2,
    },
  };
}

describe('curateProductComparePairs', () => {
  it('returns no pairs for empty inventories', () => {
    // Arrange
    const categorySlug = 'smartphones';

    // Act
    const pairs = curateProductComparePairs({ categorySlug, products: [] });

    // Assert
    expect(pairs).toEqual([]);
  });

  it('returns no pairs for single-product inventories', () => {
    // Arrange
    const categorySlug = 'smartphones';
    const products = [product('solo-phone', 200_000)];

    // Act
    const pairs = curateProductComparePairs({ categorySlug, products });

    // Assert
    expect(pairs).toEqual([]);
  });

  it('pins a required deep pair ahead of more substitutable inventory pairs', () => {
    // Arrange
    const categorySlug = 'smartphones';
    const products = [
      product('budget-one', 200_000),
      product('budget-two', 205_000),
      product('premium-one', 1_500_000),
    ];
    const requiredProductSlugs = ['budget-one', 'premium-one'];

    // Act
    const pairs = curateProductComparePairs({
      categorySlug,
      products,
      requiredProductSlugs,
    });
    const pairKeys = pairs.map(({ leftProduct, rightProduct }) =>
      [leftProduct.slug, rightProduct.slug].sort().join(':')
    );

    // Assert
    expect(pairKeys[0]).toBe('budget-one:premium-one');
    expect(pairKeys).toContain('budget-one:premium-one');
  });
});
