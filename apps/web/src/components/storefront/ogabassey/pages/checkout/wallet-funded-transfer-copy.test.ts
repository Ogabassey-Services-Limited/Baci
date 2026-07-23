import { describe, expect, it } from 'vitest';
import type { WalletOrderFundingIntentStatus } from '@/schemas/order-wallet-funding-intent';
import {
  describeWalletFundedTransfer,
  formatWalletTransferDeadline,
} from './wallet-funded-transfer-copy';

const formatCurrency = (amount: number) => `NGN ${amount.toFixed(2)}`;

function describeStatus(
  status: WalletOrderFundingIntentStatus,
  overrides: { fundedAmount?: number; remainingAmount?: number } = {}
) {
  return describeWalletFundedTransfer({
    formatCurrency,
    fundedAmount: overrides.fundedAmount ?? 0,
    remainingAmount: overrides.remainingAmount ?? 5000,
    status,
  });
}

const ALL_STATUSES: WalletOrderFundingIntentStatus[] = [
  'pending',
  'underfunded',
  'funded',
  'processing',
  'completed',
  'expired',
  'cancelled',
  'review_required',
  'failed',
];

describe('describeWalletFundedTransfer', () => {
  it('only ever claims the order is paid for `completed`', () => {
    for (const status of ALL_STATUSES) {
      expect(describeStatus(status).claimsPaid).toBe(status === 'completed');
    }
  });

  it('shows the account number while a transfer can still land', () => {
    expect(describeStatus('pending').showAccount).toBe(true);
    expect(describeStatus('underfunded').showAccount).toBe(true);
    expect(describeStatus('completed').showAccount).toBe(false);
    expect(describeStatus('expired').showAccount).toBe(false);
  });

  it('keeps polling for non-terminal states only', () => {
    for (const status of ALL_STATUSES) {
      expect(describeStatus(status).keepPolling).toBe(
        ['pending', 'underfunded', 'funded', 'processing'].includes(status)
      );
    }
  });

  it('spells out what is received and what is still owed on a partial transfer', () => {
    const partial = describeStatus('underfunded', {
      fundedAmount: 2000,
      remainingAmount: 3000,
    });

    expect(partial.body).toContain('NGN 2000.00');
    expect(partial.body).toContain('NGN 3000.00');
    expect(partial.claimsPaid).toBe(false);
  });

  it('tells the customer an ambiguous transfer is under review and NOT paid', () => {
    const review = describeStatus('review_required');

    expect(review.claimsPaid).toBe(false);
    expect(review.tone).toBe('review');
    expect(review.body).toContain('NOT paid');
    expect(review.body).toContain('safe in your wallet');
  });

  it('reassures the customer that money survives an expired window', () => {
    expect(describeStatus('expired').body).toContain('still in your wallet');
    expect(describeStatus('failed').body).toContain('still in your wallet');
  });
});

describe('formatWalletTransferDeadline', () => {
  it('formats the server-provided expiry', () => {
    expect(
      formatWalletTransferDeadline('2026-07-13T10:30:00.000Z')
    ).toMatch(/\d{2}:\d{2}/);
  });

  it('returns null for an unparseable expiry instead of inventing a time', () => {
    expect(formatWalletTransferDeadline('not-a-date')).toBeNull();
  });
});
