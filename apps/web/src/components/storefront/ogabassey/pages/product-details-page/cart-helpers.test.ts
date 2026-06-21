import { describe, expect, it } from 'vitest';
import { getAxisOptions } from './cart-helpers';
import type { NormalizedProductDetails } from './product-normalization';

function productWithVariants(
  variants: NormalizedProductDetails['variants']
): NormalizedProductDetails {
  return {
    platforms: [],
    storage: [],
    variants,
  } as unknown as NormalizedProductDetails;
}

describe('cart helpers', () => {
  it('reads variant-backed options from legacy-cased attribute keys', () => {
    const product = productWithVariants([
      {
        attributes: { Storage: '128GB' },
        id: 'variant-128',
        stock_quantity: 2,
      },
      {
        attributes: { Storage: '256GB' },
        id: 'variant-256',
        stock_quantity: 2,
      },
    ]);

    expect(getAxisOptions('storage', product)).toEqual(['128GB', '256GB']);
  });
});
