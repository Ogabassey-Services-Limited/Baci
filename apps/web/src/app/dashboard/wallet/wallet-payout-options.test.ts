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

  it('falls back to the Nigerian payout policy for blank or unknown currencies', () => {
    expect(getWalletPayoutAmountOptions('')).toEqual([
      1000, 2000, 5000, 10_000,
    ]);
    expect(getWalletPayoutAmountOptions(null)).toEqual([
      1000, 2000, 5000, 10_000,
    ]);
    expect(getWalletPayoutAmountOptions('XYZ')).toEqual([
      1000, 2000, 5000, 10_000,
    ]);
  });

  it('does not duplicate a selected amount that already exists', () => {
    expect(getWalletPayoutAmountOptions('NGN', 2000)).toEqual([
      1000, 2000, 5000, 10_000,
    ]);
  });

  it('ignores invalid selected amounts', () => {
    expect(getWalletPayoutAmountOptions('NGN', 0)).toEqual([
      1000, 2000, 5000, 10_000,
    ]);
    expect(getWalletPayoutAmountOptions('NGN', -500)).toEqual([
      1000, 2000, 5000, 10_000,
    ]);
    expect(getWalletPayoutAmountOptions('NGN', Number.NaN)).toEqual([
      1000, 2000, 5000, 10_000,
    ]);
  });
});
