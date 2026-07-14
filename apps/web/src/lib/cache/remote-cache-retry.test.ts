// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_RETRY_BASE_MS,
  retryWithBackoff,
} from './remote-cache-retry.mjs';

/**
 * Bounded retry for DROPPED INVALIDATIONS.
 *
 * A dropped `updateTags` is not like a dropped read: the shared store keeps
 * serving the PRE-MUTATION entry until its own `cacheLife.revalidate` window
 * lapses. From `next.config.ts` those windows are:
 *
 *   merchant   60s
 *   products   300s
 *   categories 3600s  ← a FULL HOUR
 *
 * So one transient blip while a merchant edits a category can mean an hour of
 * stale storefront. The dominant failure mode is a momentary blip, and a few
 * jittered retries repair it within seconds — which is why this exists.
 */
describe('retryWithBackoff', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns immediately when the first attempt succeeds', async () => {
    const operation = vi.fn().mockResolvedValue(undefined);

    const result = await retryWithBackoff(operation, { sleep: vi.fn() });

    expect(result.outcome).toBe('success');
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('repairs a TRANSIENT failure — the dominant real-world case', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await retryWithBackoff(operation, { sleep });

    expect(result.outcome).toBe('retry_success');
    expect(result.attempts).toBe(2);
  });

  it('reports a drop only after the whole budget is exhausted', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('503'));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await retryWithBackoff(operation, { sleep });

    expect(result.outcome).toBe('dropped');
    expect(result.attempts).toBe(DEFAULT_RETRY_ATTEMPTS);
    expect(operation).toHaveBeenCalledTimes(DEFAULT_RETRY_ATTEMPTS);
  });

  it('never rejects, whatever the operation does', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(
      retryWithBackoff(operation, { sleep: vi.fn() })
    ).resolves.toMatchObject({ outcome: 'dropped' });
  });

  it('backs off EXPONENTIALLY — the jitter ceiling doubles each attempt', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('503'));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await retryWithBackoff(operation, {
      sleep,
      baseMs: 100,
      random: () => 1, // pin jitter to its ceiling so the schedule is assertable
    });

    const waits = sleep.mock.calls.map(([ms]) => ms as number);
    expect(waits).toEqual([100, 200]); // 2 waits for 3 attempts, doubling
  });

  it('applies FULL jitter so a fleet does not retry in lockstep', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('503'));
    const sleep = vi.fn().mockResolvedValue(undefined);

    // Full jitter is `random() * backoff` — NOT `backoff ± jitter`. Every
    // instance sees the same blip at the same instant, so a fixed schedule would
    // have the whole fleet retry in lockstep and re-hammer a struggling backend.
    // The floor of that distribution is therefore ~0, not the backoff.
    await retryWithBackoff(operation, { sleep, baseMs: 100, random: () => 0 });

    const waits = sleep.mock.calls.map(([ms]) => ms as number);
    expect(waits).toEqual([1, 1]);
  });

  it('spreads retries across the fleet rather than pinning them to one instant', async () => {
    const observed = new Set<number>();

    for (const r of [0.1, 0.5, 0.9]) {
      const sleep = vi.fn().mockResolvedValue(undefined);
      await retryWithBackoff(vi.fn().mockRejectedValue(new Error('503')), {
        sleep,
        baseMs: 1_000,
        random: () => r,
      });
      observed.add(sleep.mock.calls[0][0] as number);
    }

    // Three instances, three different first-retry delays.
    expect(observed.size).toBe(3);
  });

  it('keeps the default retry timer referenced until the retry runs', async () => {
    let releaseTimer: (() => void) | undefined;
    const unref = vi.fn();
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      callback: () => void
    ) => {
      releaseTimer = callback;
      return { unref } as unknown as NodeJS.Timeout;
    }) as typeof setTimeout);
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValue(undefined);

    const retrying = retryWithBackoff(operation, {
      attempts: 2,
      baseMs: 1,
      random: () => 1,
    });
    await vi.waitFor(() => expect(releaseTimer).toBeDefined());
    releaseTimer?.();
    await retrying;

    expect(unref).not.toHaveBeenCalled();
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('keeps the total budget bounded — it must never block the response for long', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('503'));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await retryWithBackoff(operation, { sleep, baseMs: DEFAULT_RETRY_BASE_MS });

    const total = sleep.mock.calls.reduce(
      (sum, [ms]) => sum + (ms as number),
      0
    );
    // Worst case with the defaults stays inside a couple of seconds.
    expect(total).toBeLessThanOrEqual(3_000);
  });
});
