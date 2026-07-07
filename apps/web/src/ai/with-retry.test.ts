import { describe, expect, it, vi } from 'vitest';
import { withRetry } from './with-retry';

// Fast config so the "still retries" path doesn't sleep in the test.
const FAST_RETRY = {
  maxRetries: 3,
  initialDelayMs: 0,
  maxDelayMs: 0,
  backoffMultiplier: 2,
};

describe('withRetry', () => {
  it('does not retry once the provided signal is aborted (no wasted backoff)', async () => {
    // A per-attempt budget timeout / route deadline fired: the operation runs
    // under an already-aborted signal, so retrying is doomed and must be
    // skipped rather than sleeping through the backoff.
    const controller = new AbortController();
    controller.abort();
    const operation = vi.fn().mockRejectedValue(new Error('budget timed out'));

    await expect(
      withRetry(operation, FAST_RETRY, { signal: controller.signal })
    ).rejects.toThrow('budget timed out');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('still retries a standalone timeout when no signal is provided', async () => {
    // A signal-less caller (e.g. product-description / FAQ generation) hitting a
    // transient upstream TimeoutError must keep its retry/backoff — the skip is
    // keyed off an aborted signal, not the error name.
    const timeoutError = new Error('upstream TimeoutError');
    timeoutError.name = 'TimeoutError';
    const operation = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(operation, FAST_RETRY);
    expect(result).toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('wakes from the backoff and skips the retry when the signal aborts mid-sleep', async () => {
    // The codex-flagged race: the attempt fails just BEFORE the per-provider
    // budget expires (signal still live at catch-time), then the budget fires
    // during the backoff. withRetry must wake immediately and skip the doomed
    // retry instead of idling past the budget.
    const controller = new AbortController();
    const operation = vi.fn().mockImplementation(() => {
      // Abort shortly after the first failure — i.e. mid-backoff.
      setTimeout(() => controller.abort(), 10);
      return Promise.reject(new Error('failed right before budget expiry'));
    });

    const start = Date.now();
    await expect(
      withRetry(
        operation,
        {
          maxRetries: 3,
          initialDelayMs: 5_000,
          maxDelayMs: 5_000,
          backoffMultiplier: 2,
        },
        { signal: controller.signal }
      )
    ).rejects.toThrow('failed right before budget expiry');

    expect(operation).toHaveBeenCalledTimes(1); // no doomed retry
    expect(Date.now() - start).toBeLessThan(1_000); // woke early, not 5s
  });

  it('still retries a transient failure while the signal is live', async () => {
    const controller = new AbortController();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient 503'))
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(operation, FAST_RETRY, {
      signal: controller.signal,
    });
    expect(result).toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('fails fast on a caller-classified non-retryable error (e.g. quota)', async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new Error('rate limit reached for this model'));

    await expect(
      withRetry(operation, FAST_RETRY, {
        isNonRetryable: (error) => /rate.?limit/i.test(error.message),
      })
    ).rejects.toThrow('rate limit');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry a non-retryable (invalid) error', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('invalid request'));
    await expect(withRetry(operation, FAST_RETRY)).rejects.toThrow('invalid');
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
