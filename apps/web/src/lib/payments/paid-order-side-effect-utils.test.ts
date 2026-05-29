import { describe, expect, it } from 'vitest';
import { toNumber } from '@/lib/payments/paid-order-side-effect-utils';

describe('toNumber', () => {
  it('parses numeric strings and numbers', () => {
    expect(toNumber('123.45', 'amount')).toBe(123.45);
    expect(toNumber(200, 'amount')).toBe(200);
    expect(toNumber('  123.45  ', 'amount')).toBe(123.45);
    expect(toNumber('1e10', 'amount')).toBe(1e10);
    expect(toNumber(`${Number.MAX_VALUE}`, 'amount')).toBe(Number.MAX_VALUE);
  });

  it('parses zero values', () => {
    expect(toNumber(0, 'amount')).toBe(0);
    expect(toNumber('0', 'amount')).toBe(0);
  });

  it.each([
    [null, 'missing value'],
    [undefined, 'missing value'],
    ['', 'empty string'],
    ['   ', 'empty string'],
    ['not-a-number', 'not-a-number'],
    [Number.NaN, 'NaN'],
    [Number.POSITIVE_INFINITY, 'Infinity'],
    [Number.NEGATIVE_INFINITY, '-Infinity'],
    [-1, 'negative value'],
    ['-1', 'negative value'],
  ])('rejects invalid numeric value %s', (value, message) => {
    expect(() => toNumber(value, 'amount')).toThrow(
      `Invalid amount: ${message}`
    );
  });

  it.each([
    true,
    false,
    {},
    [],
    Symbol('amount'),
    42n,
    () => 1,
  ])('rejects unsupported numeric input type %s', (value) => {
    expect(() => toNumber(value, 'amount')).toThrow(
      'Invalid amount: must be string or number'
    );
  });
});
