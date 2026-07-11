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
        walletTransactionTotal: 0,
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
        walletTransactionTotal: 0,
      })
    ).toEqual({
      amountPaid: 800,
      balance: 0,
      paymentStatus: 'refunded',
    });
  });

  it('does not count wallet credit twice when it also has a transaction row', () => {
    const result = getEffectiveOrderPaymentSummary({
      orderTotal: 150,
      paymentStatus: 'partially_paid',
      storedAmountPaid: 100,
      transactionTotal: 100,
      walletAmountUsed: 50,
      walletTransactionTotal: 50,
    });

    expect(result).toEqual({
      amountPaid: 100,
      balance: 50,
      paymentStatus: 'partially_paid',
    });
  });

  it('adds only wallet credit not represented by transaction rows', () => {
    const result = getEffectiveOrderPaymentSummary({
      orderTotal: 150,
      paymentStatus: 'partially_paid',
      storedAmountPaid: 100,
      transactionTotal: 100,
      walletAmountUsed: 50,
      walletTransactionTotal: 20,
    });

    expect(result).toEqual({
      amountPaid: 130,
      balance: 20,
      paymentStatus: 'partially_paid',
    });
  });

  it('clamps wallet adjustment when transaction rows exceed wallet usage', () => {
    const result = getEffectiveOrderPaymentSummary({
      orderTotal: 150,
      paymentStatus: 'partially_paid',
      storedAmountPaid: 100,
      transactionTotal: 100,
      walletAmountUsed: 20,
      walletTransactionTotal: 50,
    });

    expect(result).toEqual({
      amountPaid: 100,
      balance: 50,
      paymentStatus: 'partially_paid',
    });
  });

  it('uses the order total when the stored status is already paid', () => {
    expect(
      getEffectiveOrderPaymentSummary({
        orderTotal: 500,
        paymentStatus: 'paid',
        storedAmountPaid: 300,
        transactionTotal: 200,
        walletAmountUsed: 0,
        walletTransactionTotal: 0,
      })
    ).toEqual({
      amountPaid: 500,
      balance: 0,
      paymentStatus: 'paid',
    });
  });

  it('does not reconcile a zero-total partial order to paid', () => {
    expect(
      getEffectiveOrderPaymentSummary({
        orderTotal: 0,
        paymentStatus: 'partially_paid',
        storedAmountPaid: 0,
        transactionTotal: 0,
        walletAmountUsed: 0,
        walletTransactionTotal: 0,
      })
    ).toEqual({
      amountPaid: 0,
      balance: 0,
      paymentStatus: 'partially_paid',
    });
  });

  it('preserves a zero-total refunded order', () => {
    expect(
      getEffectiveOrderPaymentSummary({
        orderTotal: 0,
        paymentStatus: 'refunded',
        storedAmountPaid: 0,
        transactionTotal: 0,
        walletAmountUsed: 0,
        walletTransactionTotal: 0,
      })
    ).toEqual({
      amountPaid: 0,
      balance: 0,
      paymentStatus: 'refunded',
    });
  });

  it('uses the stored amount when it exceeds the completed ledger total', () => {
    expect(
      getEffectiveOrderPaymentSummary({
        orderTotal: 500,
        paymentStatus: 'partially_paid',
        storedAmountPaid: 450,
        transactionTotal: 100,
        walletAmountUsed: 0,
        walletTransactionTotal: 0,
      })
    ).toEqual({
      amountPaid: 450,
      balance: 50,
      paymentStatus: 'partially_paid',
    });
  });
});
