import { describe, expect, it } from 'vitest';
import { getDiscountedTransactionUnitPrices } from './transaction-review-discount';

describe('getDiscountedTransactionUnitPrices', () => {
  it('allocates an order discount proportionally across merchandise lines', () => {
    const items = [
      { price: 100, quantity: 1 },
      { price: 300, quantity: 3 },
    ];

    const prices = getDiscountedTransactionUnitPrices(items, 80);

    expect(prices).toEqual([92, 276]);
  });

  it('leaves line prices unchanged when no usable discount or subtotal exists', () => {
    const noDiscountItems = [{ price: 100, quantity: 1 }];
    const invalidPriceItems = [{ price: 'invalid', quantity: 1 }];

    const unchangedPrices = getDiscountedTransactionUnitPrices(
      noDiscountItems,
      0
    );
    const invalidPrices = getDiscountedTransactionUnitPrices(
      invalidPriceItems,
      20
    );

    expect(unchangedPrices).toEqual([100]);
    expect(invalidPrices).toEqual([0]);
  });

  it('uses one unit when a missing quantity follows transaction-review defaults', () => {
    const items = [
      { price: 100, quantity: null },
      { price: 300, quantity: 1 },
    ];

    const prices = getDiscountedTransactionUnitPrices(items, 40);

    expect(prices).toEqual([90, 270]);
  });

  it('does not produce negative revenue when a malformed discount exceeds the subtotal', () => {
    const items = [{ price: 100, quantity: 2 }];

    const prices = getDiscountedTransactionUnitPrices(items, 500);

    expect(prices).toEqual([0]);
  });

  it('preserves negative adjustment lines while discounting merchandise', () => {
    const items = [
      { price: -100, quantity: 1 },
      { price: 100, quantity: 1 },
    ];

    const prices = getDiscountedTransactionUnitPrices(items, 50);

    expect(prices).toEqual([-100, 50]);
  });

  it('allocates discounts across merchandise and assurance fees', () => {
    const items = [{ assurance_fee: 20, price: 100, quantity: 1 }];

    const prices = getDiscountedTransactionUnitPrices(items, 12);

    expect(prices).toEqual([90]);
  });

  it('removes VAT relief from auto-negotiated merchandise discounts', () => {
    const items = [
      {
        price: 100,
        quantity: 1,
        vat_category_code: 'S',
        vat_rate: 7.5,
      },
    ];

    const prices = getDiscountedTransactionUnitPrices(items, 2.15, {
      discountIncludesVat: true,
    });

    expect(prices).toEqual([98]);
  });
});
