import { describe, expect, it } from 'vitest';
import { getOrderPaymentTransactionTotals } from './order-payment-transaction-totals';

describe('getOrderPaymentTransactionTotals', () => {
  it('separates wallet-backed rows from the complete payment total', () => {
    expect(
      getOrderPaymentTransactionTotals([
        { amount: 50, gateway: 'manual' },
        { amount: '30', gateway: 'wallet' },
        { amount: 20, gateway: 'STORE_CREDIT' },
      ])
    ).toEqual({
      transactionTotal: 100,
      walletTransactionTotal: 50,
    });
  });

  it('treats missing transactions and invalid amounts as zero', () => {
    expect(getOrderPaymentTransactionTotals(null)).toEqual({
      transactionTotal: 0,
      walletTransactionTotal: 0,
    });
    expect(
      getOrderPaymentTransactionTotals([
        { amount: null, gateway: null },
        { amount: 'invalid', gateway: 'wallet' },
      ])
    ).toEqual({
      transactionTotal: 0,
      walletTransactionTotal: 0,
    });
  });
});
