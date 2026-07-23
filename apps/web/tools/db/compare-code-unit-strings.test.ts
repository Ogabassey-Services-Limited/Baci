import { describe, expect, it } from 'vitest';
import { compareCodeUnitStrings } from './compare-code-unit-strings';

describe('compareCodeUnitStrings', () => {
  it('uses deterministic code-unit order and handles equal strings', () => {
    expect(compareCodeUnitStrings('A', 'a')).toBe(-1);
    expect(compareCodeUnitStrings('a-', 'a_')).toBe(-1);
    expect(compareCodeUnitStrings('same', 'same')).toBe(0);
    expect(compareCodeUnitStrings('z', 'a')).toBe(1);
  });
});
