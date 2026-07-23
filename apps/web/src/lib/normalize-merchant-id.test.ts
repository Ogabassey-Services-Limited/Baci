import { describe, expect, it } from 'vitest';
import { normalizeMerchantId } from '@/lib/normalize-merchant-id';

describe('normalizeMerchantId', () => {
  it.each([
    [' merchant-1 ', 'merchant-1'],
    ['', null],
    ['   ', null],
    [null, null],
    [undefined, null],
    [123, null],
    [{}, null],
  ])('normalizes %j', (value, expected) => {
    expect(normalizeMerchantId(value)).toBe(expected);
  });
});
