import { describe, expect, it } from 'vitest';
import { resolveSplitUnitIndexes } from './transaction-review-units';

describe('resolveSplitUnitIndexes', () => {
  it('returns an empty list when no per-unit data is recorded', () => {
    // No recorded units → the line stays a single combined row.
    expect(resolveSplitUnitIndexes([], 3)).toEqual([]);
  });

  it('expands to the full 0..quantity-1 range once any unit is recorded', () => {
    // Only unit 0 recorded on a 3-unit line, but all three units must render.
    expect(resolveSplitUnitIndexes([0], 3)).toEqual([0, 1, 2]);
  });

  it('does not expand a single-unit line', () => {
    expect(resolveSplitUnitIndexes([0], 1)).toEqual([0]);
  });

  it('keeps recorded indexes beyond the sold quantity (stale/out-of-range)', () => {
    // Unit 5 shouldn't exist for a 2-unit line, but is surfaced rather than hidden.
    expect(resolveSplitUnitIndexes([0, 5], 2)).toEqual([0, 1, 5]);
  });

  it('deduplicates and sorts recorded indexes', () => {
    expect(resolveSplitUnitIndexes([1, 0, 1], 2)).toEqual([0, 1]);
  });
});
