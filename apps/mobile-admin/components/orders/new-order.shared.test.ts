import { describe, expect, it } from 'vitest';
import { formatPriceInput, parseDecimalInput } from './new-order.shared';

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

describe('parseDecimalInput', () => {
  it('returns empty string for empty input', () => {
    expect(parseDecimalInput('')).toBe('');
  });

  it('strips non-numeric characters', () => {
    expect(parseDecimalInput('12abc34')).toBe('1234');
  });

  it('preserves a single decimal point', () => {
    expect(parseDecimalInput('12.50')).toBe('12.50');
  });

  it('collapses multiple decimal points into one', () => {
    expect(parseDecimalInput('1.2.3')).toBe('1.23');
  });

  it('returns a plain integer string unchanged', () => {
    expect(parseDecimalInput('500')).toBe('500');
  });

  it('strips currency symbols and spaces', () => {
    expect(parseDecimalInput('₦ 1,000.00')).toBe('1000.00');
  });

  it('handles a leading decimal point', () => {
    expect(parseDecimalInput('.5')).toBe('.5');
  });
});
