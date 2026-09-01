import { describe, expect, it } from 'vitest';
import { getProductPriceRange } from './storefront-product-price-seo';

describe('getProductPriceRange inherited variant pricing', () => {
  it('uses the parent price for variants with inherited pricing', () => {
    const range = getProductPriceRange({
      name: 'Galaxy S25',
      has_variants: true,
      price: 150000,
      manage_stock: true,
      stock: 0,
      variants: [
        { price_override: null, stock_quantity: 2 },
        { price_override: 175000, stock_quantity: 2 },
      ],
    });

    expect(range).toEqual({
      min: 150000,
      max: 175000,
      hasRange: true,
    });
  });

  it('advertises an inherited parent price when every stocked variant is nullable', () => {
    const range = getProductPriceRange({
      name: 'Galaxy S25',
      has_variants: true,
      price: 150000,
      manage_stock: true,
      stock: 0,
      variants: [{ price_override: null, stock_quantity: 2 }],
    });

    expect(range).toEqual({
      min: 150000,
      max: 150000,
      hasRange: false,
    });
  });
});
