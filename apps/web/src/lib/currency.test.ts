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

    it('prioritizes valid payout currency over country currency', () => {
      const config = getCurrencyConfig('US', 'NGN');
      expect(config).toEqual({
        code: 'NGN',
        symbol: '₦',
        locale: 'en-NG',
      });
    });

    it('preserves country locale when payout currency matches the country currency', () => {
      const config = getCurrencyConfig('FR', 'EUR');
      expect(config).toEqual({
        code: 'EUR',
        symbol: '€',
        locale: 'fr-FR',
      });
    });

    it('falls back to country currency when payout currency is invalid', () => {
      const config = getCurrencyConfig('US', 'INVALID');
      expect(config).toEqual({
        code: 'USD',
        symbol: '$',
        locale: 'en-US',
      });
    });

    it('rejects unsupported payout currency codes before country fallback', () => {
      expect(getCurrencyConfig('NG', 'XXX')).toEqual({
        code: 'NGN',
        symbol: '₦',
        locale: 'en-NG',
      });
      expect(getCurrencyConfig('US', 'ZZZ')).toEqual({
        code: 'USD',
        symbol: '$',
        locale: 'en-US',
      });
      expect(getCurrencyConfig(null, 'ABC')).toEqual({
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

    it('uses payout currency when country lookup fails', () => {
      const config = getCurrencyConfig('ZZ', 'GHS');
      expect(config).toEqual({
        code: 'GHS',
        symbol: 'GH₵',
        locale: 'en-GH',
      });
    });

    it('uses default currency when country and payout currency are invalid', () => {
      expect(getCurrencyConfig('ZZ', 'INVALID')).toEqual({
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

    it('normalizes invalid fraction digit options before formatting', () => {
      expect(
        formatCurrencyWithConfig(
          1234.567,
          { code: 'NGN', symbol: '₦', locale: 'en-NG' },
          {
            minimumFractionDigits: Number.NaN,
            maximumFractionDigits: Number.POSITIVE_INFINITY,
          }
        )
      ).toBe('₦1,234.57');
    });

    it('keeps maximumFractionDigits at least minimumFractionDigits', () => {
      expect(
        formatCurrencyWithConfig(
          1234.567,
          { code: 'NGN', symbol: '₦', locale: 'en-NG' },
          {
            minimumFractionDigits: 3,
            maximumFractionDigits: 1,
          }
        )
      ).toBe('₦1,234.567');
    });

    it('sets a compatible minimum for whole-number currency requests', () => {
      expect(
        formatCurrencyWithConfig(
          1234.56,
          { code: 'NGN', symbol: '₦', locale: 'en-NG' },
          { maximumFractionDigits: 0 }
        )
      ).toBe('₦1,235');
    });

    it('should handle undefined country (default to USD)', () => {
      expect(formatCurrency(1000)).toBe('$1,000.00');
    });

    it('uses payout currency when country is missing', () => {
      expect(formatCurrency(1000, null, undefined, 'NGN')).toBe('₦1,000.00');
    });

    it('uses payout currency when country is also set', () => {
      expect(formatCurrency(1000, 'US', undefined, 'NGN')).toBe('₦1,000.00');
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

    it('falls back when payout currency is missing or invalid', () => {
      expect(getCurrencyCode(null, null)).toBe('USD');
      expect(getCurrencySymbol(null, null)).toBe('$');
      expect(getCurrencyCode(null, undefined)).toBe('USD');
      expect(getCurrencySymbol(null, undefined)).toBe('$');
      expect(getCurrencyCode(null, 'INVALID')).toBe('USD');
      expect(getCurrencySymbol(null, 'INVALID')).toBe('$');
    });

    it('uses payout currency for symbol and code when country is also set', () => {
      expect(getCurrencyCode('US', 'NGN')).toBe('NGN');
      expect(getCurrencySymbol('US', 'NGN')).toBe('₦');
    });
  });
});
