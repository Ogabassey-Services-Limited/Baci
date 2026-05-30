import { describe, expect, it } from 'vitest';
import { chunkValues } from './chunk-values';

describe('chunkValues', () => {
  it('splits values into fixed-size chunks', () => {
    expect(chunkValues([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns one chunk when the size covers the full input', () => {
    expect(chunkValues(['a', 'b'], 10)).toEqual([['a', 'b']]);
  });

  it('returns the input as one chunk when size is not positive', () => {
    expect(chunkValues(['a', 'b'], 0)).toEqual([['a', 'b']]);
  });

  it('returns the input as one chunk when size is negative', () => {
    expect(chunkValues(['a', 'b'], -1)).toEqual([['a', 'b']]);
  });

  it('uses the integer portion of fractional chunk sizes', () => {
    expect(chunkValues([1, 2, 3, 4], 2.9)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('returns the input as one chunk when size is not finite', () => {
    expect(chunkValues(['a', 'b'], Number.NaN)).toEqual([['a', 'b']]);
    expect(chunkValues(['a', 'b'], Number.POSITIVE_INFINITY)).toEqual([
      ['a', 'b'],
    ]);
    expect(chunkValues(['a', 'b'], Number.NEGATIVE_INFINITY)).toEqual([
      ['a', 'b'],
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(chunkValues([], 2)).toEqual([]);
    expect(chunkValues([], 0)).toEqual([]);
  });
});
