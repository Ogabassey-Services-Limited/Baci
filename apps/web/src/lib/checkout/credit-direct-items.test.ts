import { describe, expect, it } from 'vitest';
import { buildCheckoutOrderItems } from './build-order-items';
import { toCreditDirectItems } from './credit-direct-items';

describe('toCreditDirectItems', () => {
  it('maps product_id/name/price/quantity into the Credit Direct line-item shape', () => {
    const result = toCreditDirectItems([
      { product_id: 'p1', name: 'Phone', price: 12000, quantity: 2 },
    ]);

    expect(result).toEqual([
      { id: 'p1', name: 'Phone', price: 12000, quantity: 2 },
    ]);
  });

  describe('bugfix: allocation weighted by display price instead of canonical price', () => {
    it('carries the quiz-voucher canonical price (0), never the display price', () => {
      // Arrange: a voucher-covered item — its display price is 50000 but the
      // canonical checkout price is 0 because it is fully covered by the voucher.
      const canonical = buildCheckoutOrderItems([
        {
          id: 'voucher-item',
          product_id: 'voucher-item',
          name: 'Won Phone',
          price: 50000,
          quantity: 1,
          quizAwardId: 'award-1',
          quizVoucherToken: 'token-1',
        },
        {
          id: 'paid-item',
          product_id: 'paid-item',
          name: 'Case',
          price: 8000,
          quantity: 1,
        },
      ]);

      // Act
      const result = toCreditDirectItems(canonical);

      // Assert: the voucher item weighs 0 (so it receives no financed slice);
      // the paid item keeps its real price. Feeding display prices would have
      // financed the voucher item and under-allocated the paid one.
      expect(result).toEqual([
        { id: 'voucher-item', name: 'Won Phone', price: 0, quantity: 1 },
        { id: 'paid-item', name: 'Case', price: 8000, quantity: 1 },
      ]);
    });

    it('carries the negotiated price, never the original cart price', () => {
      const canonical = buildCheckoutOrderItems([
        {
          id: 'nego-item',
          product_id: 'nego-item',
          name: 'Laptop',
          price: 300000,
          negotiatedPrice: 250000,
          quantity: 1,
        },
      ]);

      const result = toCreditDirectItems(canonical);

      expect(result).toEqual([
        { id: 'nego-item', name: 'Laptop', price: 250000, quantity: 1 },
      ]);
    });
  });
});
