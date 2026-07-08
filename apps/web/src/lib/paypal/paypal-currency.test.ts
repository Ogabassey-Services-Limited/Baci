import { describe, expect, it } from 'vitest';
import { formatPayPalAmount, normalizePayPalCurrency } from './paypal-currency';

describe('normalizePayPalCurrency', () => {
  it('uppercases and trims a supported currency', () => {
    const result = normalizePayPalCurrency(' usd ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('USD');
    }
  });

  it('rejects an unsupported currency instead of applying a fallback', () => {
    const result = normalizePayPalCurrency('NGN');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('UNSUPPORTED_CURRENCY');
    }
  });
});

describe('formatPayPalAmount', () => {
  it('formats a standard currency to two decimal places', () => {
    const result = formatPayPalAmount(100, 'USD');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('100.00');
    }
  });

  it('formats a zero-decimal currency as a bare integer string', () => {
    const result = formatPayPalAmount(1500, 'JPY');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('1500');
    }
  });

  it('rejects a non-integer amount for a zero-decimal currency', () => {
    const result = formatPayPalAmount(15.5, 'JPY');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('INVALID_AMOUNT');
    }
  });

  it('rejects a zero amount', () => {
    const result = formatPayPalAmount(0, 'USD');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('INVALID_AMOUNT');
    }
  });

  it('rejects a negative amount', () => {
    const result = formatPayPalAmount(-10, 'USD');
    expect(result.success).toBe(false);
  });

  it('rejects a non-finite amount', () => {
    const result = formatPayPalAmount(Number.NaN, 'USD');
    expect(result.success).toBe(false);
  });
});
