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

  it('returns null when every top-up has an unparseable created_at', () => {
    const transactions = [
      topUp('tx-broken', 300, 'not-a-date'),
      topUp('tx-empty', 400, ''),
    ];

    expect(findLatestWalletTopUpCredit(transactions)).toBeNull();
  });

  it('ignores an unparseable row and still returns a later valid top-up', () => {
    const transactions = [
      topUp('tx-broken', 300, 'not-a-date'),
      topUp('tx-good', 2500, '2026-07-13T09:00:00.000Z'),
    ];

    expect(findLatestWalletTopUpCredit(transactions)).toEqual({
      amount: 2500,
      createdAt: Date.parse('2026-07-13T09:00:00.000Z'),
      id: 'tx-good',
    });
  });

  it('does not let an unparseable first row mask a valid newer top-up', () => {
    const transactions = [
      topUp('tx-broken', 999_999, 'not-a-date'),
      topUp('tx-old', 1000, '2026-07-01T09:00:00.000Z'),
      topUp('tx-new', 2500, '2026-07-13T09:00:00.000Z'),
    ];

    expect(findLatestWalletTopUpCredit(transactions)?.id).toBe('tx-new');
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

  it('does not treat a same-instant row with a different id as new', () => {
    expect(
      isNewWalletTopUpCredit(
        { amount: 2500, createdAt: baseline.createdAt, id: 'tx-different' },
        baseline
      )
    ).toBe(false);
  });

  it('treats a row one millisecond newer than the baseline as new', () => {
    expect(
      isNewWalletTopUpCredit(
        {
          amount: 2500,
          createdAt: baseline.createdAt + 1,
          id: 'tx-different',
        },
        baseline
      )
    ).toBe(true);
  });
});
