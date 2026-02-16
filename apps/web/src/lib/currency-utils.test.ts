import { describe, expect, it } from 'vitest';
import { formatPrice } from './currency-utils';

describe('formatPrice', () => {
  it('formats USD correctly', () => {
    expect(formatPrice(1234.56, 'US')).toBe('$1,234.56');
  });

  it('formats NGN correctly', () => {
    expect(formatPrice(1234.56, 'NG')).toBe('₦1,234.56');
  });

  it('formats with options', () => {
    expect(
      formatPrice(1234.56, 'US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
    ).toBe('$1,235');
  });

  it('handles null country (defaults to USD)', () => {
    expect(formatPrice(1234.56, null)).toBe('$1,234.56');
  });
});
