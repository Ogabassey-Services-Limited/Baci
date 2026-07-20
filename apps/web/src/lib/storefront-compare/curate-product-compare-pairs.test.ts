import { describe, expect, it } from 'vitest';
import { curateProductComparePairs } from './curate-product-compare-pairs';

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
  it('returns no pairs for empty and single-product inventories', () => {
    expect(
      curateProductComparePairs({
        categorySlug: 'smartphones',
        products: [],
      })
    ).toEqual([]);
    expect(
      curateProductComparePairs({
        categorySlug: 'smartphones',
        products: [product('solo-phone', 200_000)],
      })
    ).toEqual([]);
  });

  it('pins a required deep pair ahead of more substitutable inventory pairs', () => {
    const pairs = curateProductComparePairs({
      categorySlug: 'smartphones',
      products: [
        product('budget-one', 200_000),
        product('budget-two', 205_000),
        product('premium-one', 1_500_000),
      ],
      requiredProductSlugs: ['budget-one', 'premium-one'],
    });

    const pairKeys = pairs.map(({ leftProduct, rightProduct }) =>
      [leftProduct.slug, rightProduct.slug].sort().join(':')
    );
    expect(pairKeys[0]).toBe('budget-one:premium-one');
    expect(pairKeys).toContain('budget-one:premium-one');
  });
});
