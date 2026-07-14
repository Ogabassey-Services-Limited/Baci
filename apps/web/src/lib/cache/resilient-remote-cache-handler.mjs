// @ts-check

import {
  createCircuitBreaker,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_FAILURE_THRESHOLD,
} from './remote-cache-circuit-breaker.mjs';
import { DEFAULT_MAX_ITEM_BYTES } from './remote-cache-entry-buffer.mjs';
import { createReadPipeline } from './remote-cache-read-pipeline.mjs';
import { createCacheTelemetry } from './remote-cache-telemetry.mjs';
import {
  CacheBackendTimeoutError,
  DEFAULT_BACKEND_TIMEOUT_MS,
  withTimeout,
} from './remote-cache-timeout.mjs';
import {
  createCacheTrust,
  DEFAULT_DISTRUST_MS,
} from './remote-cache-trust.mjs';
import { createWritePipeline } from './remote-cache-write-pipeline.mjs';

/**
 * The application-owned `cacheHandlers.remote` adapter (plan PR 4, §4.4).
 *
 * ## The problem
 *
 * Every remaining `'use cache: remote'` site rides Next's DEFAULT remote cache
 * handler. In `use-cache-wrapper.js` the framework does:
 *
 *     const promise = cacheHandler.set(serializedCacheKey, pendingCoarseEntry);
 *     workStore.pendingRevalidateWrites.push(promise);
 *
 * That promise is awaited only AFTER the response has been produced. When the
 * managed backend answers a write with 502/503, the promise rejects with no
 * handler attached: Node raises `unhandledRejection` and the function dies with
 * `exit 128` — the HTTP 200 already on the wire. This matches the still-unfixed
 * vercel/next.js#94751. No caller-side try/catch can contain it: the write is
 * fired by the framework outside the caller's awaited scope.
 *
 * ## The two invariants
 *
 * Everything here is a consequence of exactly two rules, each enforced at ONE
 * chokepoint so a new failure path cannot forget to honour them:
 *
 *   INVARIANT A — degrade toward the ORIGIN, never toward unverified data.
 *     Enforced in `remote-cache-read-pipeline.mjs`: if any part of the subsystem
 *     is degraded (tag state unknown, entry stream suspect, circuit open, write
 *     in flight), the read becomes a MISS. We never serve an entry whose
 *     freshness we cannot currently verify.
 *
 *   INVARIANT B — every backend interaction is time-bounded.
 *     Enforced in `remote-cache-timeout.mjs`: every backend call is raced with a
 *     deadline, and a timeout is a FAILURE (feeds the breaker), never a hang.
 *     A backend that hangs is more dangerous than one that rejects.
 *
 * It keeps the SHARED store throughout. Per the inventory's §8 correction, every
 * remaining site has a live `revalidateTag` contract, so a local-cache
 * substitution would silently break cross-instance invalidation.
 *
 * Plain ESM by necessity: Next never runs this module through the bundler. See
 * `remote-cache-handler.mjs` for the loader details.
 *
 * @typedef {import('./remote-cache-types.mjs').CacheEntry} CacheEntry
 * @typedef {import('./remote-cache-types.mjs').CacheHandler} CacheHandler
 * @typedef {import('./remote-cache-telemetry.mjs').TelemetryLogger} TelemetryLogger
 *
 * @typedef {object} ResilientRemoteCacheOptions
 * @property {CacheHandler} backend The shared store this adapter protects.
 * @property {TelemetryLogger} [logger]
 * @property {number} [maxItemBytes]
 * @property {number} [failureThreshold]
 * @property {number} [cooldownMs] Breaker cooldown — protects a sick BACKEND.
 * @property {number} [distrustMs] Trust backstop — protects CORRECTNESS. Kept
 *   separate and much shorter, because distrust pushes load onto the ORIGIN.
 * @property {number} [backendTimeoutMs]
 * @property {number} [flushIntervalMs]
 * @property {boolean} [disabled] Kill switch: degrade to miss-only.
 * @property {() => number} [now]
 *
 * @typedef {CacheHandler & { getTelemetrySnapshot: () => Record<string, number> }} ResilientRemoteCacheHandler
 */

/**
 * Brands every handler this factory produces, so the entry module can recognise
 * one of our own adapters and refuse to delegate to it (a re-imported module
 * would otherwise wrap the previous instance and recurse forever).
 */
export const RESILIENT_REMOTE_CACHE_BRAND = Symbol.for(
  'baci.resilient-remote-cache'
);

/**
 * @param {unknown} error
 * @returns {string}
 */
function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {ResilientRemoteCacheOptions} options
 * @returns {ResilientRemoteCacheHandler}
 */
export function createResilientRemoteCacheHandler(options) {
  const {
    backend,
    logger = console,
    maxItemBytes = DEFAULT_MAX_ITEM_BYTES,
    failureThreshold = DEFAULT_FAILURE_THRESHOLD,
    cooldownMs = DEFAULT_COOLDOWN_MS,
    distrustMs = DEFAULT_DISTRUST_MS,
    backendTimeoutMs = DEFAULT_BACKEND_TIMEOUT_MS,
    flushIntervalMs,
    disabled = false,
    now,
  } = options;

  const clock = now ?? Date.now;

  // READS and WRITES get INDEPENDENT breakers. The production outage this
  // handler exists for is write-only: `set()` 502s while `get()` still serves.
  // With one shared breaker every successful read reset the consecutive-failure
  // count, so the circuit never opened and we kept hammering a backend that
  // could not accept writes.
  const readBreaker = createCircuitBreaker({
    failureThreshold,
    cooldownMs,
    now,
  });
  const writeBreaker = createCircuitBreaker({
    failureThreshold,
    cooldownMs,
    now,
  });

  const telemetry = createCacheTelemetry({ logger, flushIntervalMs, now });
  // NOT cooldownMs: the breaker shields a sick backend from load, while distrust
  // shifts load onto the origin. Opposite dials — see DEFAULT_DISTRUST_MS.
  const trust = createCacheTrust({ distrustMs, now });

  const writes = createWritePipeline({
    backend,
    breaker: writeBreaker,
    telemetry,
    logger,
    maxItemBytes,
    disabled,
    backendTimeoutMs,
    now,
  });

  const reads = createReadPipeline({
    backend,
    breaker: readBreaker,
    trust,
    telemetry,
    logger,
    writes,
    maxItemBytes,
    disabled,
    backendTimeoutMs,
  });

  /** @type {ResilientRemoteCacheHandler} */
  const handler = {
    async get(cacheKey, softTags) {
      telemetry.maybeFlush();
      // Invariant A lives in the read pipeline — this is its only entry point.
      return await reads.read(cacheKey, softTags);
    },

    async set(cacheKey, pendingEntry) {
      telemetry.maybeFlush();
      // Always resolves, even on a hang — see remote-cache-write-pipeline.mjs.
      await writes.write(cacheKey, pendingEntry);
    },

    async refreshTags() {
      if (disabled) {
        telemetry.record('refresh_tags', 'skip_disabled');
        return;
      }

      if (!readBreaker.shouldAttempt()) {
        // Reads are already miss-only while the circuit is open, so there is
        // nothing left to protect.
        telemetry.record('refresh_tags', 'skip_circuit_open');
        return;
      }

      try {
        await withTimeout(
          () => backend.refreshTags(),
          backendTimeoutMs,
          'refresh_tags'
        );
        readBreaker.recordSuccess();
        telemetry.record('refresh_tags', 'success');
        trust.restore('refresh_tags');
      } catch (error) {
        readBreaker.recordFailure();
        telemetry.record(
          'refresh_tags',
          error instanceof CacheBackendTimeoutError ? 'timeout' : 'failure'
        );
        // Next awaits refreshTags BEFORE cacheHandler.get() (verified in
        // use-cache-wrapper.js ~1277). So a failure here means this instance's
        // tag manifest may be stale for the very read that follows — it could
        // hand back a PRE-INVALIDATION entry. Degrade: reads go to the origin.
        trust.degrade('refresh_tags');
        logger.warn(
          `[resilient-remote-cache] refreshTags failed, reads degraded to origin: ${describeError(error)}`
        );
      }
    },

    async getExpiration(tags) {
      if (disabled || !readBreaker.shouldAttempt()) {
        telemetry.record(
          'get_expiration',
          disabled ? 'skip_disabled' : 'skip_circuit_open'
        );
        return clock();
      }

      try {
        const expiration = await withTimeout(
          () => backend.getExpiration(tags),
          backendTimeoutMs,
          'get_expiration'
        );
        readBreaker.recordSuccess();
        telemetry.record('get_expiration', 'success');
        trust.restore('get_expiration');
        return expiration;
      } catch (error) {
        readBreaker.recordFailure();
        telemetry.record(
          'get_expiration',
          error instanceof CacheBackendTimeoutError ? 'timeout' : 'failure'
        );
        trust.degrade('get_expiration');
        logger.warn(
          `[resilient-remote-cache] getExpiration failed, discarding entry: ${describeError(error)}`
        );

        // Next awaits this AFTER cacheHandler.get() and only when an entry
        // exists (use-cache-wrapper.js ~1301-1320), so degrading trust only
        // protects LATER reads — the CURRENT entry is already in Next's hands.
        //
        // Returning Infinity would leave `implicitTagsExpiration` at 0, i.e.
        // "the implicit tags are not expired", and that entry would be served.
        // But `implicitTagsExpiration` is consumed by exactly one comparison:
        //
        //     if (entry.timestamp <= implicitTagsExpiration) return true;  // discard
        //
        // so returning a FINITE `now` says "every implicit tag was revalidated
        // as of this moment" and Next discards the entry it just took from us.
        // That is how the CURRENT read is forced to miss.
        return clock();
      }
    },

    async updateTags(tags, durations) {
      // Deliberately NOT gated on the breaker or the kill switch: invalidation
      // is correctness, not throughput, and every site on this handler depends
      // on `revalidateTag` reaching the shared store (inventory §8). Volume is
      // negligible (admin mutations), so there is no backend to protect here.
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
      } catch (error) {
        telemetry.record(
          'update_tags',
          error instanceof CacheBackendTimeoutError ? 'timeout' : 'failure'
        );
        // A dropped invalidation means stale data survives until its cacheLife
        // `revalidate` window lapses — a real freshness bug, so log it LOUDLY.
        // It still must not reject: Next awaits this in `executeRevalidates()`
        // at the end of a request that has already succeeded.
        logger.error(
          `[resilient-remote-cache] updateTags FAILED — invalidation dropped for ${tags.length} tag(s); stale entries persist until their revalidate window lapses: ${describeError(error)}`
        );
      }
    },

    getTelemetrySnapshot() {
      return telemetry.snapshot();
    },
  };

  // Non-enumerable brand so the entry module can recognise one of our own
  // adapters and refuse to delegate to it (see RESILIENT_REMOTE_CACHE_BRAND).
  Object.defineProperty(handler, RESILIENT_REMOTE_CACHE_BRAND, {
    value: true,
    enumerable: false,
  });

  return handler;
}
