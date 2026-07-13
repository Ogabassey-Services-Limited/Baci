import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/stores/cart-store', () => ({
  formatPrice: (amount: number) => `NGN ${amount}`,
}));

import { getWalletCreditStatusCopy } from './wallet-credit-status.helpers';

describe('getWalletCreditStatusCopy', () => {
  it('returns null for the idle status so no acknowledgement renders', () => {
    expect(getWalletCreditStatusCopy({ status: 'idle' })).toBeNull();
  });

  it('describes the in-flight check while checking', () => {
    const copy = getWalletCreditStatusCopy({ status: 'checking' });

    expect(copy).not.toBeNull();
    expect(copy?.icon).toBe('sync-outline');
    expect(copy?.title).toMatch(/checking/i);
  });

  it('confirms the credit with the formatted amount when known', () => {
    const copy = getWalletCreditStatusCopy({
      creditedAmount: 5000,
      status: 'credited',
    });

    expect(copy?.icon).toBe('checkmark-circle-outline');
    expect(copy?.title).toBe('Wallet credited');
    expect(copy?.message).toContain('NGN 5000');
  });

  it('confirms the credit without an amount when the delta is non-positive', () => {
    const copy = getWalletCreditStatusCopy({
      creditedAmount: 0,
      status: 'credited',
    });

    expect(copy?.title).toBe('Wallet credited');
    expect(copy?.message).not.toMatch(/NGN/);
    expect(copy?.message).toMatch(/landed in your wallet/i);
  });

  it('never claims credited on timeout and invites another check', () => {
    const copy = getWalletCreditStatusCopy({ status: 'timedOut' });

    expect(copy?.icon).toBe('refresh-circle-outline');
    expect(copy?.title).not.toMatch(/credited/i);
    expect(copy?.message).toMatch(/couldn't confirm/i);
    expect(copy?.message).toMatch(/check again/i);
  });
});
