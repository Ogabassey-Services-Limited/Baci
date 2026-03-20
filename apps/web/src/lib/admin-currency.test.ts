import { describe, expect, it } from 'vitest';
import {
  formatAdminCompactCurrency,
  formatAdminCurrency,
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
});
