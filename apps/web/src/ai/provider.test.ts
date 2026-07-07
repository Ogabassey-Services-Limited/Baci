import { describe, expect, it, vi } from 'vitest';
import { checkRateLimit, withRetry } from './provider';

// Fast config so the "still retries" path doesn't sleep in the test.
const FAST_RETRY = {
  maxRetries: 3,
  initialDelayMs: 0,
  maxDelayMs: 0,
  backoffMultiplier: 2,
};

describe('checkRateLimit', () => {
  const config = { requests: 3, windowMs: 60_000 };

  it('allows the first request in a fresh window and reports remaining', () => {
    const result = checkRateLimit(`fresh-${Math.random()}`, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetIn).toBeGreaterThan(0);
  });

  it('decrements remaining across requests and blocks once the limit is hit', () => {
    const id = `burst-${Math.random()}`;
    expect(checkRateLimit(id, config).remaining).toBe(2);
    expect(checkRateLimit(id, config).remaining).toBe(1);
    expect(checkRateLimit(id, config).remaining).toBe(0);

    const blocked = checkRateLimit(id, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetIn).toBeGreaterThan(0);
  });

  it('tracks separate identifiers independently', () => {
    const a = `id-a-${Math.random()}`;
    const b = `id-b-${Math.random()}`;
    checkRateLimit(a, config);
    checkRateLimit(a, config);
    // b is untouched by a's usage.
    expect(checkRateLimit(b, config).remaining).toBe(2);
  });
});

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
