import { describe, expect, it } from 'vitest';
import {
  getDiscountedTransactionUnitPrices,
  parseTransactionDiscountOptions,
} from './transaction-review-discount';

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

  it('applies the persisted merchandise reduction without VAT relief', () => {
    const items = [
      {
        price: 100,
        quantity: 1,
        line_id: 1,
        vat_category_code: 'S',
        vat_rate: 7.5,
      },
    ];

    const prices = getDiscountedTransactionUnitPrices(items, 2.15, {
      lineDiscounts: [{ lineId: 1, merchandiseDiscount: 2, vatRelief: 0.15 }],
    });

    expect(prices).toEqual([98]);
  });

  it('does not redistribute a negotiated line discount to full-price merchandise', () => {
    const items = [
      { line_id: 1, price: 100, quantity: 1 },
      { line_id: 2, price: 200, quantity: 1 },
    ];

    const prices = getDiscountedTransactionUnitPrices(items, 10, {
      lineDiscounts: [
        { lineId: 1, merchandiseDiscount: 10, vatRelief: 0 },
        null,
      ],
    });

    expect(prices).toEqual([90, 200]);
  });

  it('matches persisted allocations by line id after relation rows are reordered', () => {
    const items = [
      { line_id: 2, price: 200, quantity: 1 },
      { line_id: 1, price: 100, quantity: 1 },
    ];

    const prices = getDiscountedTransactionUnitPrices(items, 30, {
      lineDiscounts: [
        { lineId: 1, merchandiseDiscount: 10, vatRelief: 0 },
        { lineId: 2, merchandiseDiscount: 20, vatRelief: 0 },
      ],
    });

    expect(prices).toEqual([180, 90]);
  });

  it('falls back proportionally when persisted allocations are stale', () => {
    const items = [
      { line_id: 1, price: 100, quantity: 1 },
      { line_id: 2, price: 100, quantity: 1 },
    ];

    const prices = getDiscountedTransactionUnitPrices(items, 100, {
      lineDiscounts: [
        { lineId: 1, merchandiseDiscount: 10, vatRelief: 0 },
        { lineId: 2, merchandiseDiscount: 10, vatRelief: 0 },
      ],
    });

    expect(prices).toEqual([50, 50]);
  });

  it('ignores malformed persisted discount metadata', () => {
    expect(
      parseTransactionDiscountOptions({
        baci_transaction_discount: {
          lineDiscounts: [
            { lineId: 1, merchandiseDiscount: 'not-a-number', vatRelief: 0 },
          ],
          version: 2,
        },
      })
    ).toBeUndefined();
    expect(parseTransactionDiscountOptions(null)).toBeUndefined();
  });
});
