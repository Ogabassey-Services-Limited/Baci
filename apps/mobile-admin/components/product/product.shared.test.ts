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

  it('returns supported currency symbols and falls back to naira', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('UNKNOWN')).toBe('₦');
    expect(getCurrencySymbol(undefined)).toBe('₦');
  });
});
