import { describe, expect, it } from 'vitest';
import { buildLegacyCreditDirectTransaction } from './legacy-credit-direct-transaction';

const orderItems = [
  { product_id: 'product-1', name: 'Phone Case', price: 5000, quantity: 2 },
  { product_id: 'product-2', name: 'Charger', price: 2000, quantity: 1 },
]; // itemsTotal = 12000

const base = {
  customerEmail: 'customer@example.com',
  customerPhone: '08012345678',
  sessionId: 'session-123',
  orderId: 'order-123',
  orderItems,
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
  it('allocates the signed residual across the canonical order items', () => {
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
        productId: 'product-1',
        productName: 'Phone Case',
        productAmount: 3750,
      },
      {
        productId: 'product-2',
        productName: 'Charger',
        productAmount: 750,
      },
    ]);
    expect(
      transaction.products.reduce((s, p) => s + p.productAmount, 0)
    ).toBeCloseTo(4500, 2);
  });

  it('allocates paid shipping when voucher-covered merchandise is free', () => {
    const transaction = buildLegacyCreditDirectTransaction({
      ...base,
      signedAmount: 5000,
      orderItems: [
        {
          product_id: 'voucher-phone',
          name: 'Voucher phone',
          price: 0,
          quantity: 1,
        },
        {
          product_id: 'voucher-case',
          name: 'Voucher case',
          price: 0,
          quantity: 1,
        },
      ],
    });

    expect(transaction.products).toEqual([
      {
        productId: 'voucher-phone',
        productName: 'Voucher phone',
        productAmount: 2500,
      },
      {
        productId: 'voucher-case',
        productName: 'Voucher case',
        productAmount: 2500,
      },
    ]);
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
