import { describe, expect, it } from 'vitest';
import { walletCreditPollResponseSchema } from './wallet-credit-poll';

describe('walletCreditPollResponseSchema', () => {
  it('parses a wallet response and coerces numeric strings from the ledger', () => {
    const result = walletCreditPollResponseSchema.safeParse({
      balance: '5000',
      transactions: [
        {
          amount: '5000.5',
          balance_after: '5000.5',
          created_at: '2026-07-13T10:00:00.000Z',
          description: 'Wallet top-up via paystack',
          id: 'txn-1',
          source_type: 'wallet_topup',
          type: 'credit',
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.balance).toBe(5000);
    expect(result.data?.transactions[0]).toMatchObject({
      amount: 5000.5,
      id: 'txn-1',
      source_type: 'wallet_topup',
    });
  });

  it('accepts a null source_type (older rows) and a missing balance', () => {
    const result = walletCreditPollResponseSchema.safeParse({
      transactions: [
        { amount: 100, id: 'txn-1', source_type: null, type: 'credit' },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.balance).toBeUndefined();
    expect(result.data?.transactions[0]?.source_type).toBeNull();
  });

  it('rejects a payload with no transactions array so the poller fails closed', () => {
    expect(
      walletCreditPollResponseSchema.safeParse({ balance: 100 }).success
    ).toBe(false);
    expect(
      walletCreditPollResponseSchema.safeParse({ error: 'Unauthorized' })
        .success
    ).toBe(false);
  });

  it('rejects a transaction with an empty id or an unparseable amount', () => {
    expect(
      walletCreditPollResponseSchema.safeParse({
        transactions: [{ amount: 100, id: '', type: 'credit' }],
      }).success
    ).toBe(false);
    expect(
      walletCreditPollResponseSchema.safeParse({
        transactions: [{ amount: 'not-a-number', id: 'txn-1', type: 'credit' }],
      }).success
    ).toBe(false);
  });
});
