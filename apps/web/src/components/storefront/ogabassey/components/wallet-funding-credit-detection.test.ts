import { describe, expect, it } from 'vitest';
import type { WalletCreditPollTransaction } from '@/schemas/wallet-credit-poll';
import { detectWalletTopUpCredit } from './wallet-funding-credit-detection';

function transaction(
  overrides: Partial<WalletCreditPollTransaction> = {}
): WalletCreditPollTransaction {
  return {
    amount: 5000,
    created_at: '2026-07-13T10:00:00.000Z',
    id: 'txn-new',
    source_type: 'wallet_topup',
    type: 'credit',
    ...overrides,
  };
}

describe('detectWalletTopUpCredit', () => {
  it('detects a new wallet_topup credit that is not in the baseline', () => {
    const transactions = [transaction()];

    const credit = detectWalletTopUpCredit(transactions, new Set(['txn-old']));

    expect(credit).toEqual({ amount: 5000, id: 'txn-new' });
  });

  it('does NOT credit on cashback — a credit with a different source_type', () => {
    const transactions = [
      transaction({ id: 'txn-cashback', source_type: 'cashback' }),
    ];

    const credit = detectWalletTopUpCredit(transactions, new Set());

    expect(credit).toBeNull();
  });

  it('does NOT credit on an order refund/reversal credit', () => {
    const transactions = [
      transaction({ id: 'txn-refund', source_type: 'order_refund' }),
      transaction({ id: 'txn-reversal', source_type: 'order_reversal' }),
    ];

    const credit = detectWalletTopUpCredit(transactions, new Set());

    expect(credit).toBeNull();
  });

  it('fails closed when source_type is missing or null', () => {
    expect(
      detectWalletTopUpCredit([transaction({ source_type: null })], new Set())
    ).toBeNull();
    expect(
      detectWalletTopUpCredit(
        [transaction({ source_type: undefined })],
        new Set()
      )
    ).toBeNull();
  });

  it('ignores a debit row and a non-positive amount even when it is a top-up', () => {
    expect(
      detectWalletTopUpCredit([transaction({ type: 'debit' })], new Set())
    ).toBeNull();
    expect(
      detectWalletTopUpCredit([transaction({ amount: 0 })], new Set())
    ).toBeNull();
    expect(
      detectWalletTopUpCredit(
        [transaction({ amount: Number.NaN })],
        new Set()
      )
    ).toBeNull();
  });

  it('ignores a top-up credit that already existed before the customer armed the check', () => {
    const transactions = [transaction({ id: 'txn-known' })];

    const credit = detectWalletTopUpCredit(
      transactions,
      new Set(['txn-known'])
    );

    expect(credit).toBeNull();
  });

  it('returns null for an empty ledger', () => {
    expect(detectWalletTopUpCredit([], new Set())).toBeNull();
  });
});
