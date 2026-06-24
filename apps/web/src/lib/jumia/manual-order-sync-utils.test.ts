import { describe, expect, it } from 'vitest';
import { chunkRecords } from './manual-order-sync-utils';

describe('manual order sync utilities', () => {
  it('chunks records without dropping the tail batch', () => {
    expect(chunkRecords([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkRecords([], 2)).toEqual([]);
  });

  it.each([0, -1, 1.5])('rejects invalid chunk batch size %s', (batchSize) => {
    expect(() => chunkRecords([1, 2, 3], batchSize)).toThrow(
      'batchSize must be a positive integer'
    );
  });
});
