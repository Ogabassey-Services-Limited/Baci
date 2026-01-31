import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCurrencyCompact, getCurrencySymbol } from './currency';

describe('currency utils', () => {
  it('formats currency correctly for US', () => {
    // Note: Breaking space might be involved in some locales, but standard US/NG usually use standard spaces or simple concatenation
    // We normalize spaces to regular spaces for comparison just in case Intl uses non-breaking spaces
    const result = formatCurrency(1000, 'US').replace(/\u00A0/g, ' ');
    expect(result).toBe('$1,000.00');
  });

  it('formats currency correctly for NG', () => {
    const result = formatCurrency(1000, 'NG').replace(/\u00A0/g, ' ');
    expect(result).toBe('₦1,000.00');
  });

  it('formats currency correctly for GB', () => {
    const result = formatCurrency(1000, 'GB').replace(/\u00A0/g, ' ');
    expect(result).toBe('£1,000.00');
  });

  it('formats compact currency correctly', () => {
    expect(formatCurrencyCompact(1000, 'US').replace(/\u00A0/g, ' ')).toBe('$1,000');
    expect(formatCurrencyCompact(1000, 'NG').replace(/\u00A0/g, ' ')).toBe('₦1,000');
  });

  it('handles fallback for unknown country', () => {
    // defaults to US
    expect(formatCurrency(1000, 'XX' as any).replace(/\u00A0/g, ' ')).toBe('$1,000.00');
    expect(formatCurrency(1000, null).replace(/\u00A0/g, ' ')).toBe('$1,000.00');
  });

  it('returns correct currency symbol', () => {
    expect(getCurrencySymbol('US')).toBe('$');
    expect(getCurrencySymbol('NG')).toBe('₦');
  });
});
