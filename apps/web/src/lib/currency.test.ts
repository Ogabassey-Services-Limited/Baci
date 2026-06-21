import { describe, expect, it } from 'vitest';
import {
  COMPACT_OPTIONS,
  formatCurrency,
  formatCurrencyCompact,
  formatCurrencyWithConfig,
  getCurrencyCode,
  getCurrencyConfig,
  getCurrencySymbol,
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

    it('uses payout currency when country is missing', () => {
      const config = getCurrencyConfig(null, 'NGN');
      expect(config).toEqual({
        code: 'NGN',
        symbol: '₦',
        locale: 'en-NG',
      });
    });

    it('prioritizes country currency over payout currency', () => {
      const config = getCurrencyConfig('US', 'NGN');
      expect(config).toEqual({
        code: 'USD',
        symbol: '$',
        locale: 'en-US',
      });
    });

    it('uses the default locale for unmapped payout currencies', () => {
      const config = getCurrencyConfig(null, 'CHF');
      expect(config.code).toBe('CHF');
      expect(config.locale).toBe('en-US');
      expect(config.symbol).toBeTruthy();
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

    it('should handle COMPACT_OPTIONS constant', () => {
      expect(formatCurrency(1000, 'NG', COMPACT_OPTIONS)).toBe('₦1,000');
    });

    it('should fall back gracefully when locale is unsupported with COMPACT_OPTIONS', () => {
      // Arrange
      const invalidConfig = {
        code: 'INVALID_CODE',
        symbol: '$',
        locale: 'invalid-locale',
      };

      // Act
      const result = formatCurrencyWithConfig(
        1000,
        invalidConfig,
        COMPACT_OPTIONS
      );

      // Assert
      expect(result).toBe('$1000');
    });

    it('should handle undefined country (default to USD)', () => {
      expect(formatCurrency(1000)).toBe('$1,000.00');
    });

    it('uses payout currency when country is missing', () => {
      expect(formatCurrency(1000, null, undefined, 'NGN')).toBe('₦1,000.00');
    });
  });

  describe('formatCurrencyCompact', () => {
    it('should format without decimals', () => {
      expect(formatCurrencyCompact(1000, 'NG')).toBe('₦1,000');
    });
  });

  describe('currency helpers', () => {
    it('uses payout currency for symbol and code when country is missing', () => {
      expect(getCurrencySymbol(null, 'NGN')).toBe('₦');
      expect(getCurrencyCode(null, 'NGN')).toBe('NGN');
    });

    it('normalizes payout currency before resolving symbol and code', () => {
      expect(getCurrencyCode(null, ' ngn ')).toBe('NGN');
      expect(getCurrencySymbol(null, 'ngn')).toBe('₦');
    });
  });
});
