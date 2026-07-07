import { describe, expect, it } from 'vitest';
import {
  formatAmountInCurrency,
  formatMerchantCurrency,
  type MerchantCurrencySource,
  resolveMerchantCurrencyConfig,
} from './resolve-merchant-currency';

const NO_DOUBLE_ZERO_DECIMAL = /[.,]0{2}/;

describe('resolveMerchantCurrencyConfig', () => {
  it('resolves from payout_currency alone when country is absent', () => {
    // Arrange
    const merchant: MerchantCurrencySource = { payout_currency: 'GHS' };

    // Act
    const config = resolveMerchantCurrencyConfig(merchant);

    // Assert
    expect(config).toEqual({ code: 'GHS', symbol: 'GH₵', locale: 'en-GH' });
  });

  it('resolves USD from payout_currency alone with default locale and symbol', () => {
    // Arrange
    const merchant: MerchantCurrencySource = { payout_currency: 'USD' };

    // Act
    const config = resolveMerchantCurrencyConfig(merchant);

    // Assert
    expect(config).toEqual({ code: 'USD', symbol: '$', locale: 'en-US' });
  });

  it('resolves from country alone when payout_currency is absent', () => {
    // Arrange
    const merchant: MerchantCurrencySource = { country: 'GB' };

    // Act
    const config = resolveMerchantCurrencyConfig(merchant);

    // Assert
    expect(config).toEqual({ code: 'GBP', symbol: '£', locale: 'en-GB' });
  });

  it('resolves INR for an India merchant from country alone', () => {
    // Arrange
    const merchant: MerchantCurrencySource = { country: 'IN' };

    // Act
    const config = resolveMerchantCurrencyConfig(merchant);

    // Assert
    expect(config).toEqual({ code: 'INR', symbol: '₹', locale: 'en-IN' });
  });

  it('lets payout_currency win the code when it disagrees with country', () => {
    // Arrange: US merchant paid out in NGN.
    const merchant: MerchantCurrencySource = {
      country: 'US',
      payout_currency: 'NGN',
    };

    // Act
    const config = resolveMerchantCurrencyConfig(merchant);

    // Assert: NGN code + symbol (not the country's '$'), locale from country.
    expect(config).toEqual({ code: 'NGN', symbol: '₦', locale: 'en-US' });
  });

  it('keeps the country locale but the country symbol when both agree', () => {
    // Arrange
    const merchant: MerchantCurrencySource = {
      country: 'NG',
      payout_currency: 'NGN',
    };

    // Act
    const config = resolveMerchantCurrencyConfig(merchant);

    // Assert
    expect(config).toEqual({ code: 'NGN', symbol: '₦', locale: 'en-NG' });
  });

  it('falls back to NGN when both country and payout_currency are null', () => {
    // Arrange
    const merchant: MerchantCurrencySource = {
      country: null,
      payout_currency: null,
    };

    // Act
    const config = resolveMerchantCurrencyConfig(merchant);

    // Assert
    expect(config).toEqual({ code: 'NGN', symbol: '₦', locale: 'en-NG' });
  });

  it('falls back to NGN for an empty merchant with no fields set', () => {
    // Arrange
    const merchant: MerchantCurrencySource = {};

    // Act
    const config = resolveMerchantCurrencyConfig(merchant);

    // Assert
    expect(config).toEqual({ code: 'NGN', symbol: '₦', locale: 'en-NG' });
  });

  it.each([
    ['naira', 'non-ISO word'],
    ['', 'empty string'],
  ])('normalizes malformed payout_currency %j (%s) to NGN', (payoutCurrency) => {
    // Arrange
    const merchant: MerchantCurrencySource = {
      payout_currency: payoutCurrency,
    };

    // Act
    const config = resolveMerchantCurrencyConfig(merchant);

    // Assert
    expect(config).toEqual({ code: 'NGN', symbol: '₦', locale: 'en-NG' });
  });

  it('trims and upper-cases a padded lowercase payout_currency', () => {
    // Arrange
    const merchant: MerchantCurrencySource = { payout_currency: '  ngn  ' };

    // Act
    const config = resolveMerchantCurrencyConfig(merchant);

    // Assert
    expect(config).toEqual({ code: 'NGN', symbol: '₦', locale: 'en-NG' });
  });

  it('resolves AED with the dirham symbol for a UAE merchant', () => {
    // Arrange: AE was previously missing from countries.ts.
    const merchant: MerchantCurrencySource = {
      country: 'AE',
      payout_currency: 'AED',
    };

    // Act
    const config = resolveMerchantCurrencyConfig(merchant);

    // Assert
    expect(config).toEqual({ code: 'AED', symbol: 'د.إ', locale: 'en-AE' });
  });

  it('resolves AED from country alone for a UAE merchant', () => {
    // Arrange
    const merchant: MerchantCurrencySource = { country: 'AE' };

    // Act
    const config = resolveMerchantCurrencyConfig(merchant);

    // Assert
    expect(config).toEqual({ code: 'AED', symbol: 'د.إ', locale: 'en-AE' });
  });

  it('uses an unknown 3-letter code as its own symbol', () => {
    // Arrange
    const merchant: MerchantCurrencySource = { payout_currency: 'ZZZ' };

    // Act
    const config = resolveMerchantCurrencyConfig(merchant);

    // Assert
    expect(config).toEqual({ code: 'ZZZ', symbol: 'ZZZ', locale: 'en-US' });
  });

  it('accepts extra merchant fields via the structural type', () => {
    // Arrange: a full-ish merchant row with unrelated fields.
    const merchant = {
      id: 'merchant-1',
      name: 'Test Store',
      country: 'SN',
      payout_currency: 'XOF',
    };

    // Act
    const config = resolveMerchantCurrencyConfig(merchant);

    // Assert
    expect(config).toEqual({ code: 'XOF', symbol: 'CFA', locale: 'fr-SN' });
  });
});

describe('formatMerchantCurrency', () => {
  it('formats an NGN amount for a fallback merchant', () => {
    // Arrange / Act
    const formatted = formatMerchantCurrency(1000, {});

    // Assert
    expect(formatted).toBe('₦1,000.00');
  });

  it('formats an XOF amount with zero decimals when requested', () => {
    // Arrange: XOF is a zero-decimal currency.
    const merchant: MerchantCurrencySource = { country: 'SN' };

    // Act
    const formatted = formatMerchantCurrency(1000, merchant, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    // Assert
    expect(formatted).toMatch(/1/);
    expect(formatted).not.toMatch(NO_DOUBLE_ZERO_DECIMAL);
  });

  it('does not throw when formatting an unknown 3-letter currency code', () => {
    // Arrange
    const merchant: MerchantCurrencySource = { payout_currency: 'ZZZ' };

    // Act
    const formatted = formatMerchantCurrency(1000, merchant);

    // Assert
    expect(formatted).toContain('ZZZ');
  });
});

describe('formatAmountInCurrency', () => {
  it('formats using the currency code default locale and symbol', () => {
    // Arrange
    const amount = 4000;

    // Act
    const formatted = formatAmountInCurrency(amount, 'INR');

    // Assert
    expect(formatted).toContain('₹');
    expect(formatted).toContain('4,000');
  });

  it('falls back to NGN for missing or malformed codes', () => {
    // Arrange + Act
    const missing = formatAmountInCurrency(500, null);
    const malformed = formatAmountInCurrency(500, 'naira!');

    // Assert
    expect(missing).toContain('₦');
    expect(malformed).toContain('₦');
  });

  it('renders unknown but well-formed codes without throwing', () => {
    // Arrange + Act
    const formatted = formatAmountInCurrency(12.5, 'ZZZ');

    // Assert
    expect(formatted).toContain('ZZZ');
  });
});
