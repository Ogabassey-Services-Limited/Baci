import { describe, expect, it } from 'vitest';
import { getBoundedEnvInteger } from './bounded-env-integer';

describe('getBoundedEnvInteger', () => {
  it('returns in-range integers and clamps values outside the configured range', () => {
    expect(getBoundedEnvInteger('7', 5, 1, 10)).toBe(7);
    expect(getBoundedEnvInteger('100', 5, 1, 10)).toBe(10);
    expect(getBoundedEnvInteger('0', 5, 1, 10)).toBe(1);
  });

  it('uses the fallback for malformed or unsafe integers', () => {
    expect(getBoundedEnvInteger('1.5', 5, 1, 10)).toBe(5);
    expect(getBoundedEnvInteger('999999999999999999999', 5, 1, 10)).toBe(5);
  });

  it('keeps malformed input within bounds when the fallback is out of range', () => {
    expect(getBoundedEnvInteger('invalid', 999, 1, 10)).toBe(10);
    expect(getBoundedEnvInteger(undefined, -999, 1, 10)).toBe(1);
  });
});
