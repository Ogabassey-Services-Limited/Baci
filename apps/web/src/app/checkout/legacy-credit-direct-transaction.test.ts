import { describe, expect, it } from 'vitest';
import { buildLegacyCreditDirectTransaction } from './legacy-credit-direct-transaction';

const cart = [
  { id: 'product-1', name: 'Phone Case', price: 5000, quantity: 2 },
  { id: 'product-2', name: 'Charger', price: 2000, quantity: 1 },
]; // itemsTotal = 12000

const base = {
  customerEmail: 'customer@example.com',
  customerPhone: '08012345678',
  sessionId: 'session-123',
  orderId: 'order-123',
  cart,
};

describe('buildLegacyCreditDirectTransaction', () => {
  it('uses the server-signed amount as the popup total', () => {
    const transaction = buildLegacyCreditDirectTransaction({
      ...base,
      signedAmount: 12000,
    });

    expect(transaction.totalAmount).toBe(12000);
    expect(transaction.sessionId).toBe('session-123');
    expect(transaction.metaData).toBe('order-123');
  });

  it('keeps the itemized breakdown when the signed amount matches the cart', () => {
    const transaction = buildLegacyCreditDirectTransaction({
      ...base,
      signedAmount: 12000,
    });

    expect(transaction.products).toEqual([
      {
        productId: 'product-1',
        productName: 'Phone Case',
        productAmount: 10000,
      },
      { productId: 'product-2', productName: 'Charger', productAmount: 2000 },
    ]);
    // Products must sum to the gateway amount (payout webhook validates this).
    expect(
      transaction.products.reduce((s, p) => s + p.productAmount, 0)
    ).toBeCloseTo(transaction.totalAmount, 2);
  });
});

describe('bugfix: legacy popup total diverged from the signed residual', () => {
  it('sends a single balancing line item when the signed amount is a residual', () => {
    // Arrange: wallet/partial payment leaves a 4500 residual on a 12000 cart —
    // the exact case where sending the full-price cart broke the payout check.
    const transaction = buildLegacyCreditDirectTransaction({
      ...base,
      signedAmount: 4500,
    });

    // Assert: popup total is the residual, not order.total...
    expect(transaction.totalAmount).toBe(4500);
    // ...and products sum to it, so the payout webhook reconciles.
    expect(transaction.products).toEqual([
      {
        productId: 'order-123',
        productName: 'Order balance',
        productAmount: 4500,
      },
    ]);
    expect(
      transaction.products.reduce((s, p) => s + p.productAmount, 0)
    ).toBeCloseTo(4500, 2);
  });

  it.each([
    ['zero', 0],
    ['negative', -500],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('fails closed when the signed amount is %s', (_label, signedAmount) => {
    expect(() =>
      buildLegacyCreditDirectTransaction({ ...base, signedAmount })
    ).toThrow('Credit Direct signing response has an invalid amount');
  });
});
