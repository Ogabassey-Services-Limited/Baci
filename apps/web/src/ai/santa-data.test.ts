import { describe, expect, it } from 'vitest';
import {
  calculateSantaMaxDiscountPercentage,
  type ProductRow,
  selectSantaCatalogProducts,
} from './santa-data';

function product(index: number): ProductRow {
  return { name: `Product ${index}`, price: 10_000 - index, cost_price: null };
}

describe('Santa catalog helpers', () => {
  it('selects representative rank buckets without assuming a currency scale', () => {
    const products = Array.from({ length: 80 }, (_, index) => product(index));

    expect(selectSantaCatalogProducts(products)).toEqual(products);
  });

  it('deduplicates products after selecting rank buckets', () => {
    const products = [product(1), product(1), product(2)];

    expect(selectSantaCatalogProducts(products)).toEqual([
      product(1),
      product(2),
    ]);
  });

  it('keeps discount safety margins proportional across currencies', () => {
    expect(calculateSantaMaxDiscountPercentage(1000, 700)).toBe(29);
    expect(calculateSantaMaxDiscountPercentage(10_000_000, 7_000_000)).toBe(29);
  });
});
