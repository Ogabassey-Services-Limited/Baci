import { describe, expect, it } from 'vitest';
import { settleWithConcurrency } from './settle-with-concurrency';

describe('settleWithConcurrency', () => {
  it('never exceeds the configured concurrency', async () => {
    let active = 0;
    let peak = 0;

    const outcomes = await settleWithConcurrency(
      [1, 2, 3, 4, 5],
      2,
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active -= 1;
      }
    );

    expect(peak).toBe(2);
    expect(outcomes).toHaveLength(5);
    expect(outcomes.every((outcome) => outcome.status === 'fulfilled')).toBe(
      true
    );
  });

  it('isolates failures and continues later chunks', async () => {
    const visited: number[] = [];

    const outcomes = await settleWithConcurrency([1, 2, 3], 2, (item) => {
      visited.push(item);
      return item === 2
        ? Promise.reject(new Error('provider failed'))
        : Promise.resolve();
    });

    expect(visited).toEqual([1, 2, 3]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
    ]);
  });

  it('captures synchronous throws as per-item rejections', async () => {
    const outcomes = await settleWithConcurrency([1, 2, 3], 2, (item) => {
      if (item === 2) throw new Error('synchronous provider failure');
      return Promise.resolve();
    });

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
    ]);
  });

  it('rejects non-finite concurrency values', async () => {
    await expect(
      settleWithConcurrency([1], Number.NaN, async () => undefined)
    ).rejects.toThrow('concurrency must be finite');
    await expect(
      settleWithConcurrency(
        [1],
        Number.POSITIVE_INFINITY,
        async () => undefined
      )
    ).rejects.toThrow('concurrency must be finite');
  });
});
