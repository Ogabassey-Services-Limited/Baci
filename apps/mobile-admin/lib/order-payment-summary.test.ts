import { describe, expect, it } from 'vitest';
import { getEffectiveOrderPaymentSummary } from './order-payment-summary';

describe('getEffectiveOrderPaymentSummary', () => {
  it('reconciles a stale partial status when completed payments cover the order', () => {
    expect(
      getEffectiveOrderPaymentSummary({
        orderTotal: 982_000,
        paymentStatus: 'partially_paid',
        storedAmountPaid: 900_000,
        transactionTotal: 982_000,
        walletAmountUsed: 0,
      })
    ).toEqual({
      amountPaid: 982_000,
      balance: 0,
      paymentStatus: 'paid',
    });
  });

  it('preserves refunded status even when historical payments cover the order', () => {
    expect(
      getEffectiveOrderPaymentSummary({
        orderTotal: 800,
        paymentStatus: 'refunded',
        storedAmountPaid: 800,
        transactionTotal: 800,
        walletAmountUsed: 0,
      })
    ).toEqual({
      amountPaid: 800,
      balance: 0,
      paymentStatus: 'refunded',
    });
  });
});
