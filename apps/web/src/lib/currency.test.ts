import { describe, expect, it } from 'vitest';
import { formatCurrency, formatCurrencyCompact, getCurrencyCode } from './currency';

describe('Currency Utils', () => {
  describe('formatCurrency', () => {
    it('should format currency correctly for NG (Nigeria)', () => {
      expect(formatCurrency(1000, 'NG')).toContain('₦1,000.00');
    });

    it('should format currency correctly for US (United States)', () => {
      expect(formatCurrency(1000, 'US')).toBe('$1,000.00');
    });

    it('should format currency correctly for GB (United Kingdom)', () => {
      expect(formatCurrency(1000, 'GB')).toBe('£1,000.00');
    });

    it('should default to USD if country is missing', () => {
      expect(formatCurrency(1000, null)).toBe('$1,000.00');
    });

    it('should handle custom options', () => {
      expect(formatCurrency(1000, 'US', { minimumFractionDigits: 0 })).toBe('$1,000');
    });
  });

  describe('formatCurrencyCompact', () => {
    it('should format without decimals', () => {
      expect(formatCurrencyCompact(1000, 'NG')).toContain('₦1,000');
      expect(formatCurrencyCompact(1000, 'NG')).not.toContain('.00');
    });
  });

  describe('getCurrencyCode', () => {
      it('should return NGN for NG', () => {
          expect(getCurrencyCode('NG')).toBe('NGN');
      });
  });
});
