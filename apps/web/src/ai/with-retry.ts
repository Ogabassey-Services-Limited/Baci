import { abortableDelay } from './abortable-delay';

/**
 * Retry configuration for AI requests
 *
 * Note: `maxRetries` means the number of additional attempts after the initial try.
 * Total attempts = 1 (initial) + maxRetries = 4 attempts with default config.
 */
export const AI_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

export interface WithRetryOptions {
  /**
   * The AbortSignal the operation runs under. When it aborts (deadline,
   * per-attempt budget timeout, or cancellation) the retry is skipped — the
   * operation reuses this signal, so a retry is doomed and only burns backoff.
   * NOTE: this keys off the signal, not the error name — a standalone
   * TimeoutError from a caller that passed no signal is a transient failure
   * that SHOULD still retry.
   */
  signal?: AbortSignal;
  /**
   * Extra caller-specific classifier for errors that must NOT be retried (e.g.
   * quota / rate-limit failures a short backoff can't clear). Checked in
   * addition to the built-in non-retryable keyword list.
   */
  isNonRetryable?: (error: Error) => boolean;
}

/**
 * Wrapper for AI calls with retry logic.
 *
 * Pass `options.signal` (the same AbortSignal the operation runs under) so a
 * retry is skipped once that signal aborts. Pass `options.isNonRetryable` to
 * fail fast on provider-specific terminal errors (e.g. quota) instead of
 * wasting a retry.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config = AI_RETRY_CONFIG,
  options: WithRetryOptions = {}
): Promise<T> {
  const { signal, isNonRetryable } = options;
  let lastError: Error | null = null;
  let delay = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Never retry once the operation's own signal has aborted (deadline,
      // per-attempt budget timeout, or cancellation): `operation` reuses that
      // signal, so the retry is doomed and only wastes backoff time.
      if (signal?.aborted) {
        throw lastError;
      }

      // Caller-classified terminal errors (e.g. quota/rate-limit) — a short
      // backoff can't clear them, so fail fast instead of burning a retry and
      // an extra upstream call on an already-exhausted provider.
      if (isNonRetryable?.(lastError)) {
        throw lastError;
      }

      // Don't retry on non-retryable errors
      const errorMessage = lastError.message.toLowerCase();
      if (
        errorMessage.includes('invalid') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('forbidden') ||
        errorMessage.includes('not found')
      ) {
        throw lastError;
      }

      if (attempt < config.maxRetries) {
        // Abort-aware backoff: wake immediately if the signal fires mid-sleep
        // (an attempt can fail just BEFORE its budget expires — the catch-time
        // check above ran while the signal was still live), then re-check so
        // the doomed retry is skipped instead of overrunning the budget.
        await abortableDelay(delay, signal);
        if (signal?.aborted) {
          throw lastError;
        }
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
      }
    }
  }

  throw lastError;
}
