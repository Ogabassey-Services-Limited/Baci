import { describe, expect, it } from 'vitest';
import { compareCodePointStrings } from './compare-code-point-strings';

describe('compareCodePointStrings', () => {
  it('orders by code point rather than host locale', () => {
    expect(['ä', 'z'].sort(compareCodePointStrings)).toEqual(['z', 'ä']);
  });

  it('uses length as a deterministic prefix tie-breaker', () => {
    expect(['ab', 'a'].sort(compareCodePointStrings)).toEqual(['a', 'ab']);
  });
});
