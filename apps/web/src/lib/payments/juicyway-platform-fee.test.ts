import { describe, expect, it } from 'vitest';
import { calculateJuicywayPlatformFee } from '@/lib/payments/juicyway-platform-fee';

describe('calculateJuicywayPlatformFee', () => {
  it('normalizes the percentage fallback to kobo precision', () => {
    expect(calculateJuicywayPlatformFee(100.01)).toBe(1.5);
  });

  it.each([
    { amount: 0, expected: 0 },
    { amount: 0.99, expected: 0.01 },
    { amount: 1, expected: 0.02 },
  ])('calculates $amount as $expected', ({ amount, expected }) => {
    expect(calculateJuicywayPlatformFee(amount)).toBe(expected);
  });

  it.each([
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])('rejects an invalid gross amount: %s', (amount) => {
    expect(() => calculateJuicywayPlatformFee(amount)).toThrow(RangeError);
  });
});
