import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MIN_REQUEST_INTERVAL_MS,
  resetJumiaRateLimiterForTests,
  waitForJumiaRequestSlot,
} from '@/lib/jumia/jumia-rate-limiter';

describe('waitForJumiaRequestSlot', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetJumiaRateLimiterForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetJumiaRateLimiterForTests();
  });

  it('serializes calls for the same merchant key', async () => {
    const completionTimes: number[] = [];

    await Promise.all([
      waitForJumiaRequestSlot('merchant-1').then(() =>
        completionTimes.push(Date.now())
      ),
      waitForJumiaRequestSlot('merchant-1').then(() =>
        completionTimes.push(Date.now())
      ),
      waitForJumiaRequestSlot('merchant-1').then(() =>
        completionTimes.push(Date.now())
      ),
    ]);

    expect(completionTimes[1] - completionTimes[0]).toBeGreaterThanOrEqual(
      MIN_REQUEST_INTERVAL_MS - 50
    );
    expect(completionTimes[2] - completionTimes[1]).toBeGreaterThanOrEqual(
      MIN_REQUEST_INTERVAL_MS - 50
    );
  });

  it('does not block independent merchant keys behind each other', async () => {
    const startedAt = Date.now();

    await Promise.all([
      waitForJumiaRequestSlot('merchant-a'),
      waitForJumiaRequestSlot('merchant-b'),
    ]);

    expect(Date.now() - startedAt).toBeLessThan(MIN_REQUEST_INTERVAL_MS);
  });
});
