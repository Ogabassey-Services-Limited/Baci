import { describe, expect, it } from 'vitest';
import {
  chunkRecords,
  mapWithBoundedConcurrency,
} from './manual-order-sync-utils';

describe('manual order sync utilities', () => {
  it('chunks records without dropping the tail batch', () => {
    expect(chunkRecords([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkRecords([], 2)).toEqual([]);
  });

  it('maps values in bounded concurrent batches while preserving order', async () => {
    let active = 0;
    let maxActive = 0;

    const results = await mapWithBoundedConcurrency(
      [1, 2, 3, 4],
      2,
      async (value) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await Promise.resolve();
        active -= 1;
        return value * 10;
      }
    );

    expect(results).toEqual([10, 20, 30, 40]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
