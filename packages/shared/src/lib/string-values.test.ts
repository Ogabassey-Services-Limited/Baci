import { describe, expect, it } from 'vitest';
import { getFirstNonBlankString } from './string-values';

describe('getFirstNonBlankString', () => {
  it('returns the first trimmed nonblank string', () => {
    expect(getFirstNonBlankString(undefined, null, ' ', ' SN-123 ')).toBe(
      'SN-123'
    );
  });

  it('preserves argument ordering when multiple values are present', () => {
    expect(getFirstNonBlankString('first', 'second', 'third')).toBe('first');
    expect(getFirstNonBlankString(undefined, 'second', 'third')).toBe('second');
    expect(getFirstNonBlankString(undefined, null, '', 'only-one')).toBe(
      'only-one'
    );
  });

  it('returns an empty string when every value is blank or missing', () => {
    expect(getFirstNonBlankString(undefined, null, '', '   ')).toBe('');
  });
});
