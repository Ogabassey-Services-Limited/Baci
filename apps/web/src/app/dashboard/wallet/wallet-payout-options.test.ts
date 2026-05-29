import { describe, expect, it } from 'vitest';
import { getWalletPayoutAmountOptions } from './wallet-payout-options';

describe('getWalletPayoutAmountOptions', () => {
  it('uses the Nigerian payout policy by default', () => {
    expect(getWalletPayoutAmountOptions()).toEqual([1000, 2000, 5000, 10_000]);
  });

  it('uses the India payout policy for INR wallets', () => {
    expect(getWalletPayoutAmountOptions('inr')).toEqual([
      1000, 2500, 5000, 10_000,
    ]);
  });

  it('preserves an existing selected amount that is outside the defaults', () => {
    expect(getWalletPayoutAmountOptions('NGN', 7500)).toEqual([
      1000, 2000, 5000, 7500, 10_000,
    ]);
  });
});
