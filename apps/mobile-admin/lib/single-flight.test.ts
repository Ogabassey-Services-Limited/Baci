import { describe, expect, it, vi } from 'vitest';
import { runSingleFlight } from '@/lib/single-flight';

describe('runSingleFlight', () => {
  it('runs the first operation and skips concurrent duplicates', async () => {
    const lock = { current: false };
    let release!: () => void;
    const operation = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve('done');
        })
    );

    const firstCall = runSingleFlight(lock, operation);
    const secondCall = runSingleFlight(lock, operation);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(await secondCall).toBeUndefined();

    release();

    await expect(firstCall).resolves.toBe('done');
    expect(lock.current).toBe(false);
  });

  it('releases the lock after a failure so later retries can proceed', async () => {
    const lock = { current: false };
    const error = new Error('boom');

    await expect(
      runSingleFlight(lock, async () => {
        throw error;
      })
    ).rejects.toThrow(error);

    await expect(runSingleFlight(lock, async () => 'retry')).resolves.toBe(
      'retry'
    );
  });
});
