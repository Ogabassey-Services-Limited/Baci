// @ts-check

/**
 * INVARIANT B — every backend interaction is time-bounded.
 *
 * A remote cache backend does not only fail by rejecting; it also HANGS. A hang
 * is strictly worse than a rejection:
 *
 *  - a hung `set()` never reaches our catch/finally, so the promise Next pushed
 *    onto `pendingRevalidateWrites` stays unresolved after the response, the
 *    write circuit never opens, and the pending-write record is never cleaned;
 *  - a hung `get()`/`refreshTags()`/`getExpiration()` stalls the render for as
 *    long as the backend feels like it.
 *
 * So EVERY backend call goes through this wrapper. A timeout is a FAILURE — it
 * feeds the circuit breaker exactly like a rejection — never an indefinite wait.
 *
 * @typedef {import('./remote-cache-telemetry.mjs').CacheTelemetryOperation} CacheTelemetryOperation
 */

/** Generous for a cache: a slow cache should lose to the origin, not stall it. */
export const DEFAULT_BACKEND_TIMEOUT_MS = 2_000;

export class CacheBackendTimeoutError extends Error {
  /**
   * @param {string} operation
   * @param {number} timeoutMs
   */
  constructor(operation, timeoutMs) {
    super(`cache backend ${operation}() timed out after ${timeoutMs}ms`);
    this.name = 'CacheBackendTimeoutError';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/** Late settlements after a timeout are irrelevant — never let them surface. */
const swallow = () => undefined;

/**
 * Races a backend operation against a deadline.
 *
 * @template T
 * @param {() => Promise<T>} operation Invoked inside the wrapper so a synchronous throw is caught too.
 * @param {number} timeoutMs
 * @param {string} label Bounded operation name (never a cache key).
 * @returns {Promise<T>} Rejects with CacheBackendTimeoutError on deadline.
 */
export function withTimeout(operation, timeoutMs, label) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;

  const pending = (async () => operation())();
  // `Promise.race` attaches a handler, so a late rejection is already "handled".
  // This extra no-op catch makes that explicit and survives any refactor.
  pending.catch(swallow);

  const deadline = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new CacheBackendTimeoutError(label, timeoutMs));
    }, timeoutMs);
    // Never keep a serverless function's event loop alive for a cache timer.
    if (typeof timer === 'object' && typeof timer.unref === 'function') {
      timer.unref();
    }
  });

  return /** @type {Promise<T>} */ (
    Promise.race([pending, deadline]).finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    })
  );
}
