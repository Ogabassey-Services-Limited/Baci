import { describe, expect, it } from 'vitest';
import {
  getMerchantCurrencySymbol,
  MERCHANT_CURRENCY_LOCALES,
  MERCHANT_CURRENCY_SYMBOLS,
} from './currency-meta';

describe('MERCHANT_CURRENCY_SYMBOLS / MERCHANT_CURRENCY_LOCALES', () => {
  it('provides a locale for every currency that has a symbol', () => {
    // Arrange
    const symbolCodes = Object.keys(MERCHANT_CURRENCY_SYMBOLS);

    // Act
    const missing = symbolCodes.filter(
      (code) => !MERCHANT_CURRENCY_LOCALES[code]
    );

    // Assert
    expect(missing).toEqual([]);
  });

  it('keys every entry by a well-formed ISO 4217 code', () => {
    for (const code of [
      ...Object.keys(MERCHANT_CURRENCY_SYMBOLS),
      ...Object.keys(MERCHANT_CURRENCY_LOCALES),
    ]) {
      expect(code).toMatch(/^[A-Z]{3}$/);
    }
  });
});

describe('getMerchantCurrencySymbol', () => {
  it('returns the mapped symbol for known codes', () => {
    expect(getMerchantCurrencySymbol('NGN')).toBe('₦');
    expect(getMerchantCurrencySymbol('INR')).toBe('₹');
    expect(getMerchantCurrencySymbol('AED')).toBe('د.إ');
  });

  it('normalizes case and whitespace before lookup', () => {
    expect(getMerchantCurrencySymbol(' ngn ')).toBe('₦');
    expect(getMerchantCurrencySymbol('inr')).toBe('₹');
  });

  it('falls back to the code itself for unknown codes, never naira', () => {
    expect(getMerchantCurrencySymbol('MAD')).toBe('MAD');
  });

  it('falls back to NGN for missing input', () => {
    expect(getMerchantCurrencySymbol(null)).toBe('₦');
    expect(getMerchantCurrencySymbol(undefined)).toBe('₦');
    expect(getMerchantCurrencySymbol('')).toBe('₦');
  });
});
