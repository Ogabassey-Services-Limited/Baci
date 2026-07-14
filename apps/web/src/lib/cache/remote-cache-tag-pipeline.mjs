// @ts-check

import {
  CacheBackendTimeoutError,
  withTimeout,
} from './remote-cache-timeout.mjs';

/**
 * The TAG-STATE operations: `refreshTags`, `getExpiration`, `updateTags`.
 *
 * These are what make a cached entry's freshness *knowable*. They are grouped
 * because they share one obligation: when any of them fails, this instance can
 * no longer vouch for the tag state, and Invariant A says a read must then
 * degrade to the ORIGIN rather than serve unverified data. Each therefore
 * degrades `trust`, and each restores it when it recovers.
 *
 * Every call is deadline-bounded (Invariant B) and none of them may ever reject:
 * Next awaits `updateTags` in `executeRevalidates()` at the end of a request
 * that has ALREADY succeeded.
 *
 * @typedef {import('./remote-cache-types.mjs').CacheHandler} CacheHandler
 * @typedef {import('./remote-cache-telemetry.mjs').TelemetryLogger} TelemetryLogger
 * @typedef {import('./remote-cache-telemetry.mjs').CacheTelemetry} CacheTelemetry
 * @typedef {import('./remote-cache-breakers.mjs').CacheBreakers} CacheBreakers
 * @typedef {import('./remote-cache-trust.mjs').CacheTrust} CacheTrust
 *
 * @typedef {object} TagPipelineOptions
 * @property {CacheHandler} backend
 * @property {CacheBreakers} breakers
 * @property {CacheTrust} trust
 * @property {CacheTelemetry} telemetry
 * @property {TelemetryLogger} logger
 * @property {boolean} disabled
 * @property {number} backendTimeoutMs
 *
 * @typedef {object} TagPipeline
 * @property {() => Promise<void>} refreshTags
 * @property {(tags: string[]) => Promise<number>} getExpiration
 * @property {(tags: string[], durations?: { expire?: number }) => Promise<void>} updateTags
 */

/**
 * What `getExpiration()` returns when the tag state is UNVERIFIABLE.
 *
 * Next (`use-cache-wrapper.js` ~1305-1320):
 *
 *     const expiration = ... await lazyExpiration;   // AFTER cacheHandler.get()
 *     if (expiration < Infinity) {
 *       implicitTagsExpiration = expiration;
 *     }
 *
 * then (`shouldDiscardCacheEntry`, ~1532):
 *
 *     if (entry.timestamp <= implicitTagsExpiration) return true;   // discard
 *
 * Two constraints pin this value exactly:
 *
 *  - it must be **< Infinity**, or Next's filter drops it, `implicitTagsExpiration`
 *    stays 0 ("implicit tags are not expired"), and the entry is SERVED; and
 *  - it must be **>= every possible `entry.timestamp`**, because the comparison
 *    is `<=` — a LARGER value discards MORE.
 *
 * `Date.now()` satisfies the first but NOT the second: an entry whose timestamp
 * is in the FUTURE (clock skew across instances, or a backend-supplied
 * timestamp) is greater than now and would SURVIVE the discard — precisely the
 * pre-invalidation entry we are trying to drop. `MAX_SAFE_INTEGER` is the
 * largest finite value that still passes Next's filter, so every entry is
 * discarded when its freshness cannot be verified.
 */
export const UNVERIFIABLE_EXPIRATION = Number.MAX_SAFE_INTEGER;

/**
 * @param {unknown} error
 * @returns {string}
 */
function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {unknown} error
 * @returns {'timeout' | 'failure'}
 */
function classify(error) {
  return error instanceof CacheBackendTimeoutError ? 'timeout' : 'failure';
}

/**
 * @param {TagPipelineOptions} options
 * @returns {TagPipeline}
 */
export function createTagPipeline(options) {
  const {
    backend,
    breakers,
    trust,
    telemetry,
    logger,
    disabled,
    backendTimeoutMs,
  } = options;

  return {
    async refreshTags() {
      const breaker = breakers('refresh_tags');

      if (disabled) {
        telemetry.record('refresh_tags', 'skip_disabled');
        return;
      }

      if (!breaker.shouldAttempt()) {
        // We are NOT refreshing the tag manifest, so it is going stale — and the
        // `get` leg has its OWN breaker now, so reads are not automatically
        // miss-only here. Skipping must therefore degrade trust, or a healthy
        // `get` would serve entries against a manifest we stopped maintaining.
        telemetry.record('refresh_tags', 'skip_circuit_open');
        trust.degrade('refresh_tags');
        return;
      }

      try {
        await withTimeout(
          () => backend.refreshTags(),
          backendTimeoutMs,
          'refresh_tags'
        );
        breaker.recordSuccess();
        telemetry.record('refresh_tags', 'success');
        trust.restore('refresh_tags');
      } catch (error) {
        breaker.recordFailure();
        telemetry.record('refresh_tags', classify(error));
        // Next awaits refreshTags BEFORE cacheHandler.get() (use-cache-wrapper.js
        // ~1277), so a failure here means the tag manifest may be stale for the
        // very read that follows — it could hand back a PRE-INVALIDATION entry.
        trust.degrade('refresh_tags');
        logger.warn(
          `[resilient-remote-cache] refreshTags failed, reads degraded to origin: ${describeError(error)}`
        );
      }
    },

    async getExpiration(tags) {
      const breaker = breakers('get_expiration');

      if (disabled) {
        telemetry.record('get_expiration', 'skip_disabled');
        return UNVERIFIABLE_EXPIRATION;
      }

      if (!breaker.shouldAttempt()) {
        telemetry.record('get_expiration', 'skip_circuit_open');
        // We are NOT checking expiration, so freshness is unverifiable — exactly
        // as if the check had failed. Without degrading trust the read pipeline
        // would still go to the backend for an entry Next is about to discard on
        // the strength of the UNVERIFIABLE_EXPIRATION we return below: pointless
        // load on a backend we already believe is sick. Degrade, so reads go
        // straight to the origin (same rule as a skipped refreshTags).
        trust.degrade('get_expiration');
        return UNVERIFIABLE_EXPIRATION;
      }

      try {
        const expiration = await withTimeout(
          () => backend.getExpiration(tags),
          backendTimeoutMs,
          'get_expiration'
        );
        breaker.recordSuccess();
        telemetry.record('get_expiration', 'success');
        trust.restore('get_expiration');
        return expiration;
      } catch (error) {
        breaker.recordFailure();
        telemetry.record('get_expiration', classify(error));
        trust.degrade('get_expiration');
        logger.warn(
          `[resilient-remote-cache] getExpiration failed, discarding entry: ${describeError(error)}`
        );
        return UNVERIFIABLE_EXPIRATION;
      }
    },

    async updateTags(tags, durations) {
      // Deliberately NOT circuit-broken and NOT gated by the kill switch:
      // invalidation is correctness, not throughput, and every site on this
      // handler depends on `revalidateTag` reaching the shared store
      // (inventory §8). Volume is negligible (admin mutations).
      try {
        await withTimeout(
          () =>
            durations
              ? backend.updateTags(tags, durations)
              : backend.updateTags(tags),
          backendTimeoutMs,
          'update_tags'
        );
        telemetry.record('update_tags', 'success');
        trust.restore('update_tags');
      } catch (error) {
        telemetry.record('update_tags', classify(error));
        // A dropped bust means the shared store still holds the PRE-MUTATION
        // entry and nothing else will tell us so. Under Invariant A the tag
        // state is now unverifiable: degrade, so reads go to the origin instead
        // of confidently serving data we just failed to invalidate.
        trust.degrade('update_tags');
        // It still must not reject: Next awaits this in `executeRevalidates()`
        // at the end of a request that has already succeeded.
        logger.error(
          `[resilient-remote-cache] updateTags FAILED — invalidation dropped for ${tags.length} tag(s); reads degraded to origin, and stale entries persist until their revalidate window lapses: ${describeError(error)}`
        );
      }
    },
  };
}
