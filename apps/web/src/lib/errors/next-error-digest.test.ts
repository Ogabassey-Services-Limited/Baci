import { describe, expect, it } from 'vitest';
import { getNextErrorDigest } from './next-error-digest';

describe('getNextErrorDigest', () => {
  it('returns a trimmed Next.js digest from error-like objects', () => {
    expect(
      getNextErrorDigest(Object.assign(new Error(''), { digest: ' NEXT_123 ' }))
    ).toBe('NEXT_123');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['primitive', 'NEXT_123'],
    ['missing digest', new Error('')],
    ['empty digest', Object.assign(new Error(''), { digest: '' })],
    ['blank digest', Object.assign(new Error(''), { digest: '   ' })],
    ['non-string digest', Object.assign(new Error(''), { digest: 123 })],
  ])('returns undefined for %s', (_label, value) => {
    expect(getNextErrorDigest(value)).toBeUndefined();
  });
});
