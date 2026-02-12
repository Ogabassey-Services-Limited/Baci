import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatCurrencyCompact,
  getCurrencyConfig,
} from './currency';

describe('Currency Utils', () => {
  describe('getCurrencyConfig', () => {
    it('should return USD for unknown country', () => {
      const config = getCurrencyConfig('XX');
      expect(config).toEqual({
        code: 'USD',
        symbol: '$',
        locale: 'en-US',
      });
    });

    it('should return correct config for NG', () => {
      const config = getCurrencyConfig('NG');
      expect(config).toEqual({
        code: 'NGN',
        symbol: '₦',
        locale: 'en-NG',
      });
    });

    it('should return correct config for US', () => {
      const config = getCurrencyConfig('US');
      expect(config).toEqual({
        code: 'USD',
        symbol: '$',
        locale: 'en-US',
      });
    });
  });

  describe('formatCurrency', () => {
    it('should format NGN correctly', () => {
      expect(formatCurrency(1000, 'NG')).toBe('₦1,000.00');
    });

    it('should format USD correctly', () => {
      expect(formatCurrency(1000, 'US')).toBe('$1,000.00');
    });

    it('should handle custom options', () => {
      expect(
        formatCurrency(1000, 'US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      ).toBe('$1,000');
    });

    it('should handle undefined country (default to USD)', () => {
      expect(formatCurrency(1000)).toBe('$1,000.00');
    });
  });

  describe('formatCurrencyCompact', () => {
    it('should format without decimals', () => {
      expect(formatCurrencyCompact(1000, 'NG')).toBe('₦1,000');
    });
  });
});
