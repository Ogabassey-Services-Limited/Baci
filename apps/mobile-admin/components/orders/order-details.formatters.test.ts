import { describe, expect, it } from 'vitest';
import {
  formatOrderDetailsDate,
  formatOrderDetailsPrice,
  parseOrderDetailsCurrencyInput,
} from './order-details.formatters';

describe('order-details.formatters', () => {
  it('formats prices with the merchant currency', () => {
    expect(formatOrderDetailsPrice(12500, 'NGN')).toContain('₦');
  });

  it('preserves a single decimal point in currency input', () => {
    expect(parseOrderDetailsCurrencyInput('₦12,500.00')).toBe('12500.00');
    expect(parseOrderDetailsCurrencyInput('₦1.2.3')).toBe('1.23');
  });

  it('formats dates for the order details view', () => {
    expect(formatOrderDetailsDate('2026-04-21T10:00:00.000Z')).toContain('2026');
  });

  it('returns a dash for empty or invalid dates', () => {
    expect(formatOrderDetailsDate('')).toBe('-');
    expect(formatOrderDetailsDate('not-a-date')).toBe('-');
  });
});
