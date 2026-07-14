import { describe, expect, it } from '@jest/globals';
import {
  findLatestWalletTopUpCredit,
  isNewWalletTopUpCredit,
  type WalletTopUpCandidate,
} from './wallet-top-up-credit';

function topUp(
  id: string,
  amount: number,
  createdAt: string
): WalletTopUpCandidate {
  return {
    amount,
    created_at: createdAt,
    id,
    source_type: 'wallet_topup',
    type: 'credit',
  };
}

describe('findLatestWalletTopUpCredit', () => {
  it('returns null while the ledger is still loading', () => {
    expect(findLatestWalletTopUpCredit(undefined)).toBeNull();
  });

  it('returns null when no wallet top-up exists', () => {
    const transactions: WalletTopUpCandidate[] = [
      {
        amount: 4000,
        created_at: '2026-07-13T08:30:00.000Z',
        id: 'tx-cashback',
        source_type: 'vtu_transaction',
        type: 'cashback',
      },
      {
        amount: 7000,
        created_at: '2026-07-13T08:45:00.000Z',
        id: 'tx-reversal',
        source_type: 'order_reversal',
        type: 'credit',
      },
      {
        amount: 500,
        created_at: '2026-07-13T08:50:00.000Z',
        id: 'tx-legacy',
        source_type: null,
        type: 'credit',
      },
    ];

    expect(findLatestWalletTopUpCredit(transactions)).toBeNull();
  });

  it('picks the newest top-up regardless of list order', () => {
    const transactions = [
      topUp('tx-old', 1000, '2026-07-01T09:00:00.000Z'),
      topUp('tx-new', 2500, '2026-07-13T09:00:00.000Z'),
    ];

    expect(findLatestWalletTopUpCredit(transactions)).toEqual({
      amount: 2500,
      createdAt: Date.parse('2026-07-13T09:00:00.000Z'),
      id: 'tx-new',
    });
  });

  it('skips rows with a non-finite amount', () => {
    const transactions: WalletTopUpCandidate[] = [
      { ...topUp('tx-bad', 0, '2026-07-13T09:00:00.000Z'), amount: Number.NaN },
      topUp('tx-good', 800, '2026-07-12T09:00:00.000Z'),
    ];

    expect(findLatestWalletTopUpCredit(transactions)?.id).toBe('tx-good');
  });

  it('keeps the first match when created_at is unparseable', () => {
    const transactions = [topUp('tx-broken', 300, 'not-a-date')];

    expect(findLatestWalletTopUpCredit(transactions)).toEqual({
      amount: 300,
      createdAt: null,
      id: 'tx-broken',
    });
  });
});

describe('isNewWalletTopUpCredit', () => {
  const baseline = {
    amount: 1000,
    createdAt: Date.parse('2026-07-01T09:00:00.000Z'),
    id: 'tx-old',
  };

  it('treats any top-up as new when there was no baseline', () => {
    expect(
      isNewWalletTopUpCredit(
        { amount: 2500, createdAt: Date.now(), id: 'tx-new' },
        null
      )
    ).toBe(true);
  });

  it('returns false for the very row the baseline was taken from', () => {
    expect(isNewWalletTopUpCredit(baseline, baseline)).toBe(false);
  });

  it('returns true for a different, newer row', () => {
    expect(
      isNewWalletTopUpCredit(
        {
          amount: 2500,
          createdAt: Date.parse('2026-07-13T09:00:00.000Z'),
          id: 'tx-new',
        },
        baseline
      )
    ).toBe(true);
  });

  it('returns false for a different row that predates the baseline', () => {
    expect(
      isNewWalletTopUpCredit(
        {
          amount: 2500,
          createdAt: Date.parse('2026-06-01T09:00:00.000Z'),
          id: 'tx-older',
        },
        baseline
      )
    ).toBe(false);
  });

  it('falls back to id inequality when a timestamp is unparseable', () => {
    expect(
      isNewWalletTopUpCredit(
        { amount: 2500, createdAt: null, id: 'tx-new' },
        baseline
      )
    ).toBe(true);
  });
});
