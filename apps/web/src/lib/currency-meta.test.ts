import { describe, expect, it } from 'vitest';
import { COUNTRIES } from './countries';
import { CURRENCY_DEFAULT_LOCALES, CURRENCY_SYMBOLS } from './currency-meta';

describe('CURRENCY_SYMBOLS', () => {
  it('covers the currency of every country in countries.ts', () => {
    // Arrange
    const countryCurrencies = [...new Set(COUNTRIES.map((c) => c.currency))];

    // Act
    const missing = countryCurrencies.filter((code) => !CURRENCY_SYMBOLS[code]);

    // Assert
    expect(missing).toEqual([]);
  });

  it('keys every entry by a well-formed ISO 4217 code with a non-empty symbol', () => {
    for (const [code, symbol] of Object.entries(CURRENCY_SYMBOLS)) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect(symbol.length).toBeGreaterThan(0);
    }
  });
});

describe('CURRENCY_DEFAULT_LOCALES', () => {
  it('provides a locale for every currency that has a symbol', () => {
    // Arrange
    const symbolCodes = Object.keys(CURRENCY_SYMBOLS);

    // Act
    const missing = symbolCodes.filter(
      (code) => !CURRENCY_DEFAULT_LOCALES[code]
    );

    // Assert
    expect(missing).toEqual([]);
  });

  it('only contains locales Intl can format currency with', () => {
    for (const [code, locale] of Object.entries(CURRENCY_DEFAULT_LOCALES)) {
      // Arrange + Act: constructing the formatter throws on malformed locales
      const format = () =>
        new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: code,
        }).format(1234.5);

      // Assert
      expect(format).not.toThrow();
      expect(format().length).toBeGreaterThan(0);
    }
  });

  it('formats NGN with the en-NG default locale and naira symbol', () => {
    // Arrange
    const locale = CURRENCY_DEFAULT_LOCALES.NGN;

    // Act
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'NGN',
    }).format(1000);

    // Assert
    expect(locale).toBe('en-NG');
    expect(formatted).toContain('₦');
  });
});
