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

  it('keeps quiz voucher discounts on awarded lines', () => {
    const items = [
      { price: 100, quantity: 1, quiz_award_id: 'award-1' },
      { price: 200, quantity: 1 },
    ];

    const prices = getDiscountedTransactionUnitPrices(items, 100);

    expect(prices).toEqual([0, 200]);
  });

  it('applies a residual voucher discount after explicit merchandise allocations', () => {
    const items = [
      { line_id: 1, price: 100, quantity: 1, quiz_award_id: 'award-1' },
      { line_id: 2, price: 200, quantity: 1 },
    ];
    const options = {
      lineDiscounts: [
        null,
        { lineId: 2, merchandiseDiscount: 20, vatRelief: 0 },
      ],
    };

    const prices = getDiscountedTransactionUnitPrices(items, 120, options);

    expect(prices).toEqual([0, 180]);
  });

  it('allocates discounts across merchandise and assurance fees', () => {
    const items = [{ assurance_fee: 20, price: 100, quantity: 1 }];

    const prices = getDiscountedTransactionUnitPrices(items, 12);

    expect(prices).toEqual([90]);
  });

  it('ignores malformed persisted discount metadata', () => {
    const malformedOptions = parseTransactionDiscountOptions({
      baci_transaction_discount: {
        lineDiscounts: [
          { lineId: 1, merchandiseDiscount: 'not-a-number', vatRelief: 0 },
        ],
        version: 2,
      },
    });
    const nullOptions = parseTransactionDiscountOptions(null);

    expect(malformedOptions).toBeUndefined();
    expect(nullOptions).toBeUndefined();
  });

  it('parses a valid version-3 server allocation', () => {
    const adTracking = {
      baci_transaction_discount: {
        lineDiscounts: [
          {
            lineId: 1,
            merchandiseDiscount: 20,
            productId: 'product-1',
            vatRelief: 1.5,
            variantId: null,
          },
        ],
        version: 3,
      },
    };

    const parsed = parseTransactionDiscountOptions(adTracking);

    expect(parsed).toEqual({
      lineDiscounts: [
        {
          lineId: 1,
          merchandiseDiscount: 20,
          productId: 'product-1',
          vatRelief: 1.5,
          variantId: null,
        },
      ],
    });
  });

  it('parses a valid legacy version-2 server allocation', () => {
    const adTracking = {
      baci_transaction_discount: {
        lineDiscounts: [{ lineId: 1, merchandiseDiscount: 20, vatRelief: 1.5 }],
        version: 2,
      },
    };

    const parsed = parseTransactionDiscountOptions(adTracking);

    expect(parsed).toEqual({
      lineDiscounts: [{ lineId: 1, merchandiseDiscount: 20, vatRelief: 1.5 }],
    });
  });
});
