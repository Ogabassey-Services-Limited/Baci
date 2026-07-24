import { describe, expect, it } from 'vitest';
import { formatPrice, getCurrencyForCountry } from './currency-utils';

describe('formatPrice', () => {
  it('formats USD correctly', () => {
    expect(formatPrice(1234.56, 'US')).toBe('$1,234.56');
  });

  it('formats NGN correctly', () => {
    expect(formatPrice(1234.56, 'NG')).toBe('₦1,234.56');
  });

  it('formats with options', () => {
    expect(
      formatPrice(1234.56, 'US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
    ).toBe('$1,235');
  });

  it('handles null country (defaults to USD)', () => {
    expect(formatPrice(1234.56, null)).toBe('$1,234.56');
  });
});

describe('getCurrencyForCountry — CFA mappings (Codex #P1 regression)', () => {
  // These four countries previously fell through to the USD fallback, mislabelling
  // CFA merchants' prices. A future map change must not silently restore that.
  it.each([
    ['CM', 'XAF'],
    ['SN', 'XOF'],
    ['CI', 'XOF'],
    ['BF', 'XOF'],
  ])('maps %s to %s (not the USD fallback)', (country, expected) => {
    expect(getCurrencyForCountry(country)).toBe(expected);
  });

  it('still falls back to USD for genuinely unknown countries', () => {
    expect(getCurrencyForCountry('ZZ')).toBe('USD');
    expect(getCurrencyForCountry(null)).toBe('USD');
  });
});
