import { describe, expect, it } from 'vitest';
import { formatPriceInput } from './new-order.shared';

describe('formatPriceInput', () => {
  it('returns an empty string when the input is undefined', () => {
    expect(formatPriceInput(undefined)).toBe('');
  });

  it('returns an empty string when the input is an empty string', () => {
    expect(formatPriceInput('')).toBe('');
  });

  it('formats a plain integer with thousands separator', () => {
    expect(formatPriceInput('1000')).toBe('1,000');
  });

  it('preserves decimal portion when present', () => {
    expect(formatPriceInput('1000.50')).toBe('1,000.50');
  });

  it('passes through a non-numeric string unchanged', () => {
    // Integer portion 'abc' is NaN so the raw portion is returned as-is
    expect(formatPriceInput('abc')).toBe('abc');
  });

  it('formats a negative value using the locale formatter', () => {
    // Number('-5') is valid, so toLocaleString renders '-5'
    expect(formatPriceInput('-5')).toBe('-5');
  });
});
