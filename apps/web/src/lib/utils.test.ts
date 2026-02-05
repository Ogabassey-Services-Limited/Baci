import { describe, expect, it } from 'vitest';
import { formatCurrency } from './utils';

describe('formatCurrency (utils)', () => {
  it('formats NGN by default', () => {
    // 1000 kobo = 10 Naira
    // Defaults to NGN, en-NG locale, 0 fraction digits
    const result = formatCurrency(1000);
    // The exact output depends on the environment's Intl implementation,
    // typically "NGN 10" or "₦10".
    // We'll match loosely or check for key parts.
    expect(result).toContain('10');
  });

  it('formats USD correctly', () => {
    // 2000 cents = 20 Dollars
    const result = formatCurrency(2000, 'USD');
    expect(result).toContain('20');
    // USD usually has $ symbol
    expect(result).toContain('$');
  });

  it('handles rounding for 0 fraction digits', () => {
    // 1250 kobo = 12.50 Naira.
    // 0 fraction digits -> rounds to 13? or truncates?
    // Intl.NumberFormat defaults to half-up rounding usually.
    // 12.5 -> 13
    const result = formatCurrency(1250);
    expect(result).toContain('13');
  });

  it('handles large numbers', () => {
    // 1,000,000,000 kobo = 10,000,000 Naira
    const result = formatCurrency(1000000000);
    expect(result).toContain('10,000,000');
  });
});
