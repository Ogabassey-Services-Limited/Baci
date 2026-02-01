import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatCurrencyCompact,
  getCurrencyConfig,
} from './currency';

describe('Currency Utilities', () => {
  it('should format currency correctly for Nigeria (NG)', () => {
    // Note: The exact spacing might depend on the environment's locale data,
    // but typically it's "₦1,000.00" or "NGN 1,000.00".
    // Based on the code, it uses 'en-NG' locale and 'symbol' display.
    // Allow for potential non-breaking space issues in assertions if necessary,
    // but for now assume standard space.
    const result = formatCurrency(1000, 'NG');
    expect(result).toContain('1,000.00');
    expect(result).toContain('₦');
  });

  it('should format currency correctly for USA (US)', () => {
    expect(formatCurrency(1000, 'US')).toBe('$1,000.00');
  });

  it('should format currency correctly for UK (GB)', () => {
    expect(formatCurrency(1000, 'GB')).toBe('£1,000.00');
  });

  it('should fallback to USD if country code is missing or invalid', () => {
    expect(formatCurrency(1000, null)).toBe('$1,000.00');
    expect(formatCurrency(1000, 'XX')).toBe('$1,000.00');
  });

  it('should respect custom options', () => {
    expect(formatCurrency(1000, 'US', { minimumFractionDigits: 0 })).toBe(
      '$1,000'
    );
  });

  it('should format compact currency correctly', () => {
    const ngResult = formatCurrencyCompact(1000, 'NG');
    expect(ngResult).toContain('1,000');
    expect(ngResult).toContain('₦');

    expect(formatCurrencyCompact(1000, 'US')).toBe('$1,000');
  });

  it('should get correct currency config', () => {
    expect(getCurrencyConfig('NG')).toEqual({
      code: 'NGN',
      symbol: '₦',
      locale: 'en-NG',
    });
    expect(getCurrencyConfig('US')).toEqual({
      code: 'USD',
      symbol: '$',
      locale: 'en-US',
    });
  });
});
