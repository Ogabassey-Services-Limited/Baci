import { describe, expect, it } from 'vitest';
import {
  formatLargePrice,
  formatMetric,
  formatPrice,
  getCurrencySymbol,
} from './product.shared';

describe('product.shared formatters', () => {
  it('formats plain prices with locale separators', () => {
    expect(formatPrice(12_500, '₦')).toBe('₦12,500');
  });

  it('formats large prices using compact suffixes without trailing zeros', () => {
    expect(formatLargePrice(999, '₦')).toBe('₦999');
    expect(formatLargePrice(50_000, '₦')).toBe('₦50k');
    expect(formatLargePrice(999_950, '₦')).toBe('₦999.9k');
    expect(formatLargePrice(1_250_000, '$')).toBe('$1.25M');
    expect(formatLargePrice(999_999_500, '₦')).toBe('₦1B');
    expect(formatLargePrice(1_234_567_890, '₦')).toBe('₦1.235B');
    expect(formatLargePrice(999_999_500_000, '₦')).toBe('₦1T');
  });

  it('formats unit metrics compactly', () => {
    expect(formatMetric(950)).toBe('950');
    expect(formatMetric(1_200)).toBe('1.2k');
    expect(formatMetric(999_950)).toBe('999.9k');
    expect(formatMetric(1_000_000)).toBe('1M');
    expect(formatMetric(999_999_500)).toBe('1B');
  });

  it('returns supported currency symbols for major and Baci multi-country currencies', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('INR')).toBe('₹');
    expect(getCurrencySymbol('AED')).toBe('د.إ');
    expect(getCurrencySymbol('KES')).toBe('KSh');
    expect(getCurrencySymbol('GHS')).toBe('GH₵');
    expect(getCurrencySymbol('ZAR')).toBe('R');
    expect(getCurrencySymbol('EGP')).toBe('E£');
    expect(getCurrencySymbol('XAF')).toBe('FCFA');
    expect(getCurrencySymbol('XOF')).toBe('CFA');
    expect(getCurrencySymbol('CAD')).toBe('$');
    expect(getCurrencySymbol('AUD')).toBe('$');
    expect(getCurrencySymbol('JPY')).toBe('¥');
    expect(getCurrencySymbol('BRL')).toBe('R$');
    expect(getCurrencySymbol(undefined)).toBe('₦');
  });

  it('falls back to the currency code itself for unrecognized codes instead of naira', () => {
    expect(getCurrencySymbol('UNKNOWN')).toBe('UNKNOWN');
    expect(getCurrencySymbol('sar')).toBe('SAR');
  });
});
