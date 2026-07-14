// @ts-check

/**
 * Circuit breaker for the application-owned remote cache handler.
 *
 * Without it, a sick cache backend is contacted once per cache read *per
 * request* — every remaining `'use cache: remote'` site pays the backend's full
 * failure latency (or timeout) before falling through to the origin. Under
 * crawler load that turns a degraded cache into a degraded site.
 *
 * States:
 *   closed    — normal operation; consecutive failures are counted.
 *   open      — the backend is presumed sick; callers skip it entirely.
 *   half_open — the cooldown elapsed; exactly ONE probe is admitted. If it
 *               succeeds the circuit closes; if it fails the cooldown restarts.
 *
 * NOTE: this module is loaded by Node directly (see `next.config.ts`
 * `cacheHandlers.remote`), so it must stay dependency-free plain ESM — Next
 * imports the handler via `pathToFileURL()` + dynamic `import()` and never runs
 * it through the bundler. See `remote-cache-handler.mjs` for the full rationale.
 *
 * @typedef {'closed' | 'open' | 'half_open'} CircuitState
 *
 * @typedef {object} CircuitBreakerOptions
 * @property {number} [failureThreshold] Consecutive failures that trip the circuit.
 * @property {number} [cooldownMs] How long the circuit stays open before probing.
 * @property {() => number} [now] Injectable clock (tests).
 *
 * @typedef {object} CircuitBreaker
 * @property {() => boolean} shouldAttempt True when the caller may touch the backend.
 * @property {() => void} recordSuccess
 * @property {() => void} recordFailure
 * @property {() => CircuitState} getState
 */

export const DEFAULT_FAILURE_THRESHOLD = 5;
export const DEFAULT_COOLDOWN_MS = 30_000;

/**
 * @param {CircuitBreakerOptions} [options]
 * @returns {CircuitBreaker}
 */
export function createCircuitBreaker(options = {}) {
  const failureThreshold =
    options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const now = options.now ?? Date.now;

  /** @type {CircuitState} */
  let state = 'closed';
  let consecutiveFailures = 0;
  let openedAt = 0;
  let probeInFlight = false;

  return {
    shouldAttempt() {
      if (state === 'closed') {
        return true;
      }

      if (state === 'open') {
        if (now() - openedAt < cooldownMs) {
          return false;
        }
        // Cooldown elapsed — admit a single probe.
        state = 'half_open';
        probeInFlight = true;
        return true;
      }

      // half_open: only one caller probes a backend that is still presumed sick.
      if (probeInFlight) {
        return false;
      }
      probeInFlight = true;
      return true;
    },

    recordSuccess() {
      state = 'closed';
      consecutiveFailures = 0;
      probeInFlight = false;
    },

    recordFailure() {
      probeInFlight = false;

      if (state === 'half_open') {
        // The probe failed: restart the cooldown from *now*, not from the
        // original trip, so a long-dead backend is not re-probed every call.
        state = 'open';
        openedAt = now();
        return;
      }

      consecutiveFailures += 1;
      if (consecutiveFailures >= failureThreshold) {
        state = 'open';
        openedAt = now();
      }
    },

    getState() {
      return state;
    },
  };
}
