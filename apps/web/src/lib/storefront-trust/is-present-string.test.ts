import { describe, expect, it } from 'vitest';
import { isPresentString } from './is-present-string';

describe('isPresentString', () => {
  it('returns true only for strings with non-whitespace content', () => {
    expect(isPresentString('support@ogabassey.com')).toBe(true);
    expect(isPresentString('  support@ogabassey.com  ')).toBe(true);
    expect(isPresentString('')).toBe(false);
    expect(isPresentString('   ')).toBe(false);
    expect(isPresentString(null)).toBe(false);
    expect(isPresentString(undefined)).toBe(false);
  });
});
