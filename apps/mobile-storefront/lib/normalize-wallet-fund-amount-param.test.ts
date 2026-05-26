import { describe, expect, it } from '@jest/globals';
import { normalizeWalletFundAmountParam } from './normalize-wallet-fund-amount-param';

describe('normalizeWalletFundAmountParam', () => {
  it('normalizes valid route amounts to whole naira values', () => {
    expect(normalizeWalletFundAmountParam('1750.25')).toBe('1751');
    expect(normalizeWalletFundAmountParam(['1000'])).toBe('1000');
    expect(normalizeWalletFundAmountParam(['1000', '2000'])).toBe('1000');
  });

  it('returns an empty amount for missing or invalid route values', () => {
    expect(normalizeWalletFundAmountParam(undefined)).toBe('');
    expect(normalizeWalletFundAmountParam('')).toBe('');
    expect(normalizeWalletFundAmountParam('-100')).toBe('');
    expect(normalizeWalletFundAmountParam('not-a-number')).toBe('');
    expect(normalizeWalletFundAmountParam('Infinity')).toBe('');
    expect(normalizeWalletFundAmountParam('NaN')).toBe('');
    expect(normalizeWalletFundAmountParam('0')).toBe('');
    expect(normalizeWalletFundAmountParam('0.0')).toBe('');
  });
});
