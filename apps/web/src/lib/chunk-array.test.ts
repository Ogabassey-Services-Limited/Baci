import { describe, expect, it } from 'vitest';
import { chunkArray, SUPABASE_IN_FILTER_CHUNK_SIZE } from './chunk-array';

describe('chunkArray', () => {
  it('splits items into chunks of the requested size', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single chunk when items fit within one chunk', () => {
    expect(chunkArray(['a', 'b'], 5)).toEqual([['a', 'b']]);
  });

  it('returns no chunks for an empty list', () => {
    expect(chunkArray([], 3)).toEqual([]);
  });

  it('keeps the Supabase .in() chunk size well under URL limits', () => {
    const tokens = Array.from({ length: 250 }, (_, i) => `token-${i}`);

    const chunks = chunkArray(tokens, SUPABASE_IN_FILTER_CHUNK_SIZE);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[2]).toHaveLength(50);
  });
});
