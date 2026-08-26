import { describe, expect, it } from 'vitest';
import { getDiscountedTransactionUnitPrices } from './transaction-review-discount';

describe('getDiscountedTransactionUnitPrices', () => {
  it('allocates an order discount proportionally across merchandise lines', () => {
    const prices = getDiscountedTransactionUnitPrices(
      [
        { price: 100, quantity: 1 },
        { price: 300, quantity: 3 },
      ],
      80
    );

    expect(prices).toEqual([92, 276]);
  });

  it('leaves line prices unchanged when no usable discount or subtotal exists', () => {
    expect(
      getDiscountedTransactionUnitPrices([{ price: 100, quantity: 1 }], 0)
    ).toEqual([100]);
    expect(
      getDiscountedTransactionUnitPrices(
        [{ price: 'invalid', quantity: 1 }],
        20
      )
    ).toEqual([0]);
  });

  it('uses one unit when a missing quantity follows transaction-review defaults', () => {
    expect(
      getDiscountedTransactionUnitPrices(
        [
          { price: 100, quantity: null },
          { price: 300, quantity: 1 },
        ],
        40
      )
    ).toEqual([90, 270]);
  });

  it('does not produce negative revenue when a malformed discount exceeds the subtotal', () => {
    expect(
      getDiscountedTransactionUnitPrices([{ price: 100, quantity: 2 }], 500)
    ).toEqual([0]);
  });
});
