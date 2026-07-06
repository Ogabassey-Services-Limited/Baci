/**
 * Tiny consecutive-failure circuit breaker for the middleware preflight RPC
 * transport. Without it, a Supabase brownout would stall EVERY storefront
 * document navigation for the full abort budget (up to twice, serialized) —
 * today's route-based transport is shielded by the data cache serving stale,
 * so the direct-DB transport needs an equivalent blast-radius bound.
 *
 * Semantics: `openUntil` is set after `threshold` CONSECUTIVE failures; while
 * open, callers skip the RPC and fail open instantly. After `cooldownMs` the
 * next caller becomes the half-open probe (state resets to closed-with-history
 * so a single success clears it and a single failure re-opens immediately).
 * State is per-middleware-instance module state — approximate by design; the
 * goal is bounding incident amplification, not distributed consensus.
 */
export interface StorefrontPreflightCircuitBreaker {
  /** True when calls should be skipped (fail open) without probing. */
  isOpen(now?: number): boolean;
  /** Record a transport-level failure (timeout / network / 5xx-class). */
  recordFailure(now?: number): void;
  /** Record a successful round trip; fully closes the breaker. */
  recordSuccess(): void;
  /** True exactly once per open transition — callers capture ONE exception. */
  consumeOpenTransition(): boolean;
  /** Test hook. */
  reset(): void;
}

const DEFAULT_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 30_000;

export function createStorefrontPreflightCircuitBreaker(
  options: { threshold?: number; cooldownMs?: number } = {}
): StorefrontPreflightCircuitBreaker {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;

  let consecutiveFailures = 0;
  let openUntil = 0;
  let openTransitionPending = false;

  return {
    isOpen(now = Date.now()) {
      if (openUntil > now) {
        return true;
      }
      if (openUntil !== 0) {
        // Cooldown elapsed: let the next caller probe (half-open). Keep the
        // failure streak one below the threshold so a single probe failure
        // re-opens immediately while a success fully closes.
        openUntil = 0;
        consecutiveFailures = threshold - 1;
      }
      return false;
    },
    recordFailure(now = Date.now()) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= threshold && openUntil <= now) {
        openUntil = now + cooldownMs;
        openTransitionPending = true;
      }
    },
    recordSuccess() {
      consecutiveFailures = 0;
      openUntil = 0;
      openTransitionPending = false;
    },
    consumeOpenTransition() {
      if (openTransitionPending) {
        openTransitionPending = false;
        return true;
      }
      return false;
    },
    reset() {
      consecutiveFailures = 0;
      openUntil = 0;
      openTransitionPending = false;
    },
  };
}
