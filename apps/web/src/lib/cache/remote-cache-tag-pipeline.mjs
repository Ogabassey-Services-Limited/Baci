// @ts-check

import { retryWithBackoff } from './remote-cache-retry.mjs';
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
 * @property {number} cooldownMs Breaker cooldown — how long a circuit stays open.
 * @property {number} droppedBustDistrustMs Distrust TTL after a DROPPED invalidation.
 * @property {import('./remote-cache-retry.mjs').RetryOptions} [retryOptions]
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
    cooldownMs,
    droppedBustDistrustMs,
    retryOptions,
  } = options;
  let invalidationRepairsPending = 0;

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
        // Distrust must OUTLIVE the circuit: while it is open we are not probing
        // this leg, so the short "until the next retry" backstop would lapse
        // mid-outage and reads would resume against a manifest we stopped
        // maintaining.
        trust.degrade('refresh_tags', cooldownMs);
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
        // as if the check had failed. Without this, the read pipeline would still
        // go to the backend for an entry Next is about to discard on the strength
        // of the UNVERIFIABLE_EXPIRATION we return below: pointless load on a
        // backend we already believe is sick.
        //
        // The distrust must last as long as the CIRCUIT, not the short default
        // backstop. Next calls get() BEFORE getExpiration(), so if the 5s window
        // lapsed while the 30s cooldown was still running, the next request's
        // get() would fetch and buffer an entry that getExpiration was about to
        // have discarded anyway — once per window, throughout the outage.
        trust.degrade('get_expiration', cooldownMs);
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
        // Once this failure opens (or re-opens) the circuit there will be no
        // recovery probe for a full cooldown. Keep distrust alive for that same
        // window so get() cannot resume fetching entries that Next will discard.
        trust.degrade(
          'get_expiration',
          breaker.getState() === 'open' ? cooldownMs : undefined
        );
        logger.warn(
          `[resilient-remote-cache] getExpiration failed, discarding entry: ${describeError(error)}`
        );
        return UNVERIFIABLE_EXPIRATION;
      }
    },

    /**
     * Deliberately NOT circuit-broken and NOT gated by the kill switch:
     * invalidation is correctness, not throughput, and every site on this handler
     * depends on `revalidateTag` reaching the shared store (inventory §8). Volume
     * is negligible (admin mutations).
     *
     * It is the one operation that gets a RETRY, because it is the one whose
     * failure is DURABLE. A failed read self-heals — the route recomputes and the
     * next request tries again. A failed bust does not: the shared store keeps
     * serving the pre-mutation entry to every instance until its own
     * `cacheLife.revalidate` window lapses. From `next.config.ts` that is 60s for
     * `merchant`, 300s for `products`, and **3600s for `categories`** — so one
     * transient blip while a merchant edits a category can mean an HOUR of stale
     * storefront. Degrading trust bounds what *we* serve for a few seconds; it
     * does nothing about what the shared store hands everyone else.
     */
    async updateTags(tags, durations) {
      let repairPending = false;
      const result = await retryWithBackoff(async () => {
        try {
          await withTimeout(
            () =>
              durations
                ? backend.updateTags(tags, durations)
                : backend.updateTags(tags),
            backendTimeoutMs,
            'update_tags'
          );
        } catch (error) {
          // Reads must miss throughout retry backoff while the bust is unlanded.
          if (!repairPending) {
            repairPending = true;
            invalidationRepairsPending += 1;
          }
          trust.degrade('update_tags');
          throw error;
        }
      }, retryOptions);

      if (result.outcome !== 'dropped') {
        // `success` (first try) vs `retry_success` (a blip we REPAIRED) are kept
        // apart on purpose: the second is the metric that tells us how often the
        // durable gap would have bitten without this retry.
        telemetry.record(
          'update_tags',
          result.outcome === 'success' ? 'success' : 'retry_success'
        );
        if (repairPending) invalidationRepairsPending -= 1;
        if (invalidationRepairsPending === 0) {
          trust.restore('update_tags');
        }

        if (result.outcome === 'retry_success') {
          logger.warn(
            `[resilient-remote-cache] updateTags recovered after ${result.attempts} attempts for ${tags.length} tag(s) — invalidation landed, no staleness`
          );
        }
        return;
      }

      // Budget exhausted: this is now a genuinely DROPPED invalidation.
      telemetry.record('update_tags', 'dropped');
      // Under Invariant A the tag state is unverifiable: degrade, so reads go to
      // the origin instead of confidently serving data we failed to invalidate.
      //
      // The TTL is REASON-SCOPED and much longer than the 5s default backstop.
      // That default is sized for a transient read-path blip which the next
      // request re-probes away; a dropped bust is nothing like it. The stale
      // entry survives in the shared store for the whole cacheLife revalidate
      // window (up to 1h for `categories`), so a 5s distrust would have us
      // cheerfully serving that stale entry 5 seconds later.
      //
      // HONEST LIMIT: this only stops THIS instance serving it. Other instances
      // never saw the failed bust, have no distrust, and will read the same stale
      // entry out of the shared store. It trades staleness for origin load on one
      // instance — a legitimate mitigation (the census says the origin can take
      // it), NOT a cure. Only a durable outbox closes the cross-instance gap.
      // Keep this separate from the transient `update_tags` reason. A later
      // successful invalidation proves only that its own tags landed; it cannot
      // repair an earlier dropped bust for different tags.
      trust.degrade('dropped_update_tags', droppedBustDistrustMs);
      if (repairPending) invalidationRepairsPending -= 1;
      if (invalidationRepairsPending === 0) {
        trust.restore('update_tags');
      }
      // It still must not reject: Next awaits this in `executeRevalidates()` at
      // the end of a request that has ALREADY succeeded.
      logger.error(
        `[resilient-remote-cache] updateTags DROPPED after ${result.attempts} attempts for ${tags.length} tag(s); reads degraded to origin, but the SHARED STORE still holds the pre-mutation entry until its cacheLife revalidate window lapses (categories: up to 1h): ${describeError(result.error)}`
      );
    },
  };
}
