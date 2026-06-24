import { describe, expect, it } from 'vitest';
import { mapWithBoundedConcurrency } from './manual-order-sync-concurrency';

describe('mapWithBoundedConcurrency', () => {
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

  it.each([
    0, -1, 1.5,
  ])('rejects invalid map concurrency %s', async (concurrency) => {
    await expect(
      mapWithBoundedConcurrency([1, 2], concurrency, async (value) => value)
    ).rejects.toThrow('concurrency must be a positive integer');
  });

  it('rejects when a mapped item rejects', async () => {
    await expect(
      mapWithBoundedConcurrency([1, 2], 2, async (value) => {
        await Promise.resolve();
        if (value === 2) throw new Error('mapper failed');
        return value;
      })
    ).rejects.toThrow('mapper failed');
  });
});
