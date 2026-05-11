import { describe, expect, it } from 'vitest';
import {
  formatAdminCompactCurrency,
  formatAdminCurrency,
  formatAdminThresholdCurrency,
} from '@/lib/admin-currency';

describe('admin-currency', () => {
  it('formats admin values in naira by default', () => {
    expect(formatAdminCurrency(1000)).toBe('₦1,000.00');
    expect(formatAdminCurrency(0)).toBe('₦0.00');
    expect(formatAdminCurrency(-1000)).toBe('-₦1,000.00');
    expect(formatAdminCurrency(1234.56)).toBe('₦1,234.56');
  });

  it('formats compact admin values in naira', () => {
    expect(formatAdminCompactCurrency(1500000)).toBe('₦1.5M');
    expect(formatAdminCompactCurrency(999)).toBe('₦999');
    expect(formatAdminCompactCurrency(1000)).toBe('₦1K');
    expect(formatAdminCompactCurrency(999999)).toBe('₦1M');
    expect(formatAdminCompactCurrency(1000000)).toBe('₦1M');
    expect(formatAdminCompactCurrency(1000000000)).toBe('₦1B');
  });

  it('treats nullish and invalid values as zero', () => {
    expect(formatAdminCurrency(null)).toBe('₦0.00');
    expect(formatAdminCurrency('not-a-number')).toBe('₦0.00');
    expect(formatAdminCompactCurrency(null)).toBe('₦0');
    expect(formatAdminCompactCurrency('not-a-number')).toBe('₦0');
  });

  it('uses compact formatting only when values cross the admin threshold', () => {
    expect(formatAdminThresholdCurrency(0)).toBe('₦0.00');
    expect(formatAdminThresholdCurrency(999)).toBe('₦999.00');
    expect(formatAdminThresholdCurrency(1000)).toBe('₦1K');
    expect(formatAdminThresholdCurrency('1200')).toBe('₦1.2K');
    expect(formatAdminThresholdCurrency(1_000_000_000)).toBe('₦1B');
    expect(formatAdminThresholdCurrency('1200000000')).toBe('₦1.2B');
    expect(formatAdminThresholdCurrency('not-a-number')).toBe('₦0.00');
    expect(formatAdminThresholdCurrency(null)).toBe('₦0.00');
    expect(formatAdminThresholdCurrency(undefined)).toBe('₦0.00');
    expect(formatAdminThresholdCurrency(-1)).toBe('-₦1.00');
  });
});
