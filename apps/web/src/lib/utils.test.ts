import { describe, expect, it } from 'vitest';
import { formatCurrency } from './utils';

describe('formatCurrency', () => {
  it('formats NGN correctly', () => {
    // 1000 kobo = 10 Naira
    expect(formatCurrency(1000, 'NGN')).toBe('₦10');
    // 100000 kobo = 1000 Naira
    expect(formatCurrency(100000, 'NGN')).toBe('₦1,000');
  });

  it('formats USD correctly with en-NG locale', () => {
    // 1000 cents = 10 dollars
    // en-NG locale formats USD as US$10 or $10. Let's check output.
    // We expect it to be consistent.
    const result = formatCurrency(1000, 'USD');
    expect(result).toContain('10');
    expect(result).toMatch(/(\$|US\$)/);
  });

  it('uses default currency NGN', () => {
    expect(formatCurrency(1000)).toBe('₦10');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('₦0');
  });
});
