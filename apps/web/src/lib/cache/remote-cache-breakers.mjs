// @ts-check

import {
  createCircuitBreaker,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_FAILURE_THRESHOLD,
} from './remote-cache-circuit-breaker.mjs';

/**
 * PER-LEG circuit breakers.
 *
 * ## The breaker model, and why it is per-leg
 *
 * A shared breaker cannot detect a partial outage, because a healthy leg's
 * successes reset the consecutive-failure count of a sick one. We have now hit
 * this exact bug twice, at two different granularities:
 *
 *  1. Reads vs writes. `set()` 502s while `get()` still serves — every
 *     successful read reset the count, so the write circuit never opened.
 *
 *  2. `get` vs the other read-side legs. Next calls `refreshTags()` BEFORE
 *     `get()` on EVERY request (`use-cache-wrapper.js` ~1277). With one shared
 *     read breaker, a successful `refreshTags` recorded a success each request
 *     and reset the count — so during a get-ONLY outage the circuit never
 *     opened and we hammered the backend forever.
 *
 * The generalisation: **failure accounting must be per-operation**, because that
 * is the granularity at which a backend actually fails. Each leg gets its own
 * breaker, so an outage confined to one operation opens exactly that operation
 * and leaves the others flowing.
 *
 * `updateTags` is deliberately absent — invalidation is correctness, not
 * throughput, so it is never circuit-broken (only deadline-bounded).
 *
 * @typedef {import('./remote-cache-circuit-breaker.mjs').CircuitBreaker} CircuitBreaker
 * @typedef {'get' | 'set' | 'refresh_tags' | 'get_expiration'} CacheBreakerLeg
 *
 * @typedef {object} CacheBreakerOptions
 * @property {number} [failureThreshold]
 * @property {number} [cooldownMs]
 * @property {() => number} [now]
 *
 * @typedef {(leg: CacheBreakerLeg) => CircuitBreaker} CacheBreakers
 */

/** @type {readonly CacheBreakerLeg[]} */
export const CACHE_BREAKER_LEGS = Object.freeze([
  'get',
  'set',
  'refresh_tags',
  'get_expiration',
]);

/**
 * @param {CacheBreakerOptions} [options]
 * @returns {CacheBreakers}
 */
export function createCacheBreakers(options = {}) {
  const failureThreshold =
    options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const now = options.now;

  /** @type {Map<CacheBreakerLeg, CircuitBreaker>} */
  const breakers = new Map();
  for (const leg of CACHE_BREAKER_LEGS) {
    breakers.set(
      leg,
      createCircuitBreaker({ failureThreshold, cooldownMs, now })
    );
  }

  return (leg) => {
    const breaker = breakers.get(leg);
    if (!breaker) {
      throw new Error(`Unknown cache breaker leg: ${leg}`);
    }
    return breaker;
  };
}
