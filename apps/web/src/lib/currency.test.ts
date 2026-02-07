import { describe, expect, it } from 'vitest';
import { formatCurrency, formatCurrencyCompact } from './currency';

describe('formatCurrency', () => {
  it('formats currency correctly for NG', () => {
    const result = formatCurrency(1000, 'NG');
    // Assuming locale en-NG uses NGN symbol
    expect(result).toContain('₦');
    expect(result).toContain('1,000.00');
  });

  it('formats currency correctly for US', () => {
    const result = formatCurrency(1000, 'US');
    expect(result).toBe('$1,000.00');
  });

  it('formats currency with options', () => {
    const result = formatCurrency(1000, 'US', { minimumFractionDigits: 0 });
    expect(result).toBe('$1,000');
  });

  it('handles undefined options (optimization target)', () => {
    const result = formatCurrency(1234.56, 'US');
    expect(result).toBe('$1,234.56');
  });

  it('handles empty options object', () => {
     const result = formatCurrency(1234.56, 'US', {});
     expect(result).toBe('$1,234.56');
  });

  it('formats compact currency', () => {
    const result = formatCurrencyCompact(1000, 'NG');
    expect(result).toContain('₦');
    expect(result).toContain('1,000');
    expect(result).not.toContain('.00');
  });

  it('fallback to default config if country code is missing', () => {
     const result = formatCurrency(100, null);
     expect(result).toBe('$100.00');
  });
});
