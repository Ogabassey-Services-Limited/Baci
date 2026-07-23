import { describe, expect, it, vi } from 'vitest';
import {
  emptyWalletResponse,
  formatFundingAccount,
  logOptionalWalletHelperFailure,
  toNumber,
} from './wallet-data-helpers';

describe('toNumber', () => {
  it('coerces numeric strings and falls back to 0 for junk', () => {
    expect(toNumber('5000')).toBe(5000);
    expect(toNumber(null)).toBe(0);
    expect(toNumber('not-a-number')).toBe(0);
  });
});

describe('formatFundingAccount', () => {
  it('returns null for a non-paystack (or missing) row', () => {
    expect(formatFundingAccount(null)).toBeNull();
    expect(
      formatFundingAccount({
        account_name: 'x',
        account_number: '1',
        bank_name: 'b',
        provider: 'kuda',
      })
    ).toBeNull();
  });

  it('maps a paystack row to the client shape', () => {
    expect(
      formatFundingAccount({
        account_name: 'Ogabassey/Jane',
        account_number: '1234567890',
        bank_name: 'Titan',
        provider: 'paystack',
      })
    ).toEqual({
      accountName: 'Ogabassey/Jane',
      accountNumber: '1234567890',
      bankName: 'Titan',
      provider: 'paystack',
    });
  });
});

describe('emptyWalletResponse', () => {
  it('advertises consent by default but respects an explicit override', () => {
    expect(emptyWalletResponse().requiresFundingAccountConsent).toBe(true);
    expect(
      emptyWalletResponse({ requiresFundingAccountConsent: false })
        .requiresFundingAccountConsent
    ).toBe(false);
  });
});

describe('logOptionalWalletHelperFailure', () => {
  it('logs a rejected optional read but ignores a fulfilled one', () => {
    const error = new Error('timeout');
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    logOptionalWalletHelperFailure('funding account', {
      reason: error,
      status: 'rejected',
    });
    logOptionalWalletHelperFailure('savings balance', {
      status: 'fulfilled',
      value: 1000,
    });

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      'Customer wallet optional fetch failed',
      { error, label: 'funding account' }
    );
    consoleError.mockRestore();
  });
});
