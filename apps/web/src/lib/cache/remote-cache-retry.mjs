// @ts-check

/**
 * Bounded retry with exponential backoff + full jitter.
 *
 * ## Why an invalidation gets a retry when a read does not
 *
 * A failed read is self-healing: the route recomputes from the origin and the
 * next request tries again. A failed **invalidation** is not. The shared store
 * keeps serving the PRE-MUTATION entry until its own `cacheLife.revalidate`
 * window lapses, and nothing else in the system will ever notice. From
 * `next.config.ts`:
 *
 *   | profile    | revalidate |
 *   |------------|------------|
 *   | merchant   | 60s        |
 *   | products   | 300s       |
 *   | categories | **3600s**  |  ← a FULL HOUR
 *
 * So a single transient blip while a merchant edits a category can leave the
 * storefront stale for an hour. Degrading trust bounds what WE serve for a few
 * seconds; it does nothing about what the shared store keeps handing to every
 * other instance. The failure is durable, so the response must be too.
 *
 * The dominant real-world failure is a momentary blip, and a few jittered
 * retries repair that within seconds — which is the cheap 90% of the fix.
 *
 * **Full jitter** (`random() * backoff`, not `backoff ± jitter`) is deliberate:
 * every instance in the fleet observes the same backend blip at the same moment,
 * so a fixed schedule would have them all retry in lockstep and re-hammer a
 * backend that is already struggling.
 *
 * @typedef {'success' | 'retry_success' | 'dropped'} RetryOutcome
 *
 * @typedef {object} RetryResult
 * @property {RetryOutcome} outcome
 * @property {number} attempts
 * @property {unknown} [error] The final error, when dropped.
 *
 * @typedef {object} RetryOptions
 * @property {number} [attempts] Total attempts INCLUDING the first.
 * @property {number} [baseMs]
 * @property {(ms: number) => Promise<void>} [sleep]
 * @property {() => number} [random]
 */

/** 3 attempts: the original + 2 retries. */
export const DEFAULT_RETRY_ATTEMPTS = 3;

/** 250ms → worst-case total wait ~750ms. Bounded on purpose. */
export const DEFAULT_RETRY_BASE_MS = 250;

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function defaultSleep(ms) {
  // This promise is part of the invalidation operation itself. Its timer must
  // remain referenced; otherwise Node may exit before the awaited retry fires,
  // silently dropping the tag bust this helper exists to preserve.
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `operation` until it succeeds or the attempt budget is exhausted.
 * NEVER rejects — the outcome is always a value.
 *
 * @param {() => Promise<unknown>} operation
 * @param {RetryOptions} [options]
 * @returns {Promise<RetryResult>}
 */
export async function retryWithBackoff(operation, options = {}) {
  const attempts = options.attempts ?? DEFAULT_RETRY_ATTEMPTS;
  const baseMs = options.baseMs ?? DEFAULT_RETRY_BASE_MS;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  /** @type {unknown} */
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await operation();
      return {
        outcome: attempt === 1 ? 'success' : 'retry_success',
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;

      if (attempt === attempts) break;

      // Exponential backoff with FULL jitter, so a fleet that all saw the same
      // blip does not retry in lockstep.
      const backoff = baseMs * 2 ** (attempt - 1);
      await sleep(Math.max(1, Math.round(random() * backoff)));
    }
  }

  return { outcome: 'dropped', attempts, error: lastError };
}
