import { describe, expect, it } from 'vitest';
import { isFiniteNumber } from './is-finite-number';

describe('isFiniteNumber', () => {
  it('accepts finite numbers and rejects non-finite values', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(42)).toBe(true);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber('42')).toBe(false);
  });
});
