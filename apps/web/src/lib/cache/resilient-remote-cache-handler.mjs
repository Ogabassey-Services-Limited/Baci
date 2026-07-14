// @ts-check

import {
  createCircuitBreaker,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_FAILURE_THRESHOLD,
} from './remote-cache-circuit-breaker.mjs';
import { DEFAULT_MAX_ITEM_BYTES } from './remote-cache-entry-buffer.mjs';
import { createCacheTelemetry } from './remote-cache-telemetry.mjs';
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
 * `exit 128` — the HTTP 200 already on the wire, the warm in-memory cache gone
 * with it. This matches the still-unfixed vercel/next.js#94751 (auto-closed for
 * want of a public reproduction, not because a fix shipped). No caller-side
 * try/catch can contain it: the write is fired by the framework outside the
 * caller's awaited scope.
 *
 * ## The contract
 *
 * This adapter wraps — never replaces — the platform's shared remote store, and
 * guarantees:
 *
 *  - a failed `get()` RESOLVES as a MISS (never throws) → the route recomputes
 *    from the origin and still renders correct, complete data;
 *  - a failed `set()` RESOLVES quietly (never rejects) → the process-killer;
 *  - oversized items are refused (logged + skipped, never thrown);
 *  - a sick backend is short-circuited by a breaker and probed on a cooldown;
 *  - telemetry uses BOUNDED labels only — a cache key is never a label.
 *
 * Crucially it keeps the SHARED store. Per the inventory's §8 correction, every
 * remaining site has a live `revalidateTag` contract, so a local-cache
 * substitution would silently break cross-instance invalidation. `updateTags`
 * therefore always delegates — even with the circuit open — because invalidation
 * is correctness, not throughput.
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
 * @property {number} [cooldownMs]
 * @property {number} [flushIntervalMs]
 * @property {boolean} [disabled] Kill switch: degrade to miss-only.
 * @property {() => number} [now]
 *
 * @typedef {CacheHandler & { getTelemetrySnapshot: () => Record<string, number> }} ResilientRemoteCacheHandler
 */

/**
 * Brands every handler this factory produces.
 *
 * Next installs us *into* the same handler map we read our backend from, so the
 * entry module must be able to recognise one of our own adapters and refuse to
 * delegate to it. Without this, a re-imported module would wrap the previous
 * instance and recurse forever. `Symbol.for` keeps the brand stable across
 * module instances (registry-based, not identity-based).
 */
export const RESILIENT_REMOTE_CACHE_BRAND = Symbol.for(
  'baci.resilient-remote-cache'
);

/**
 * @param {unknown} error
 * @returns {string}
 */
function describeError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
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
    flushIntervalMs,
    disabled = false,
    now,
  } = options;

  const breaker = createCircuitBreaker({ failureThreshold, cooldownMs, now });
  const telemetry = createCacheTelemetry({ logger, flushIntervalMs, now });
  const writes = createWritePipeline({
    backend,
    breaker,
    telemetry,
    logger,
    maxItemBytes,
    disabled,
  });

  /** @type {ResilientRemoteCacheHandler} */
  const handler = {
    async get(cacheKey, softTags) {
      telemetry.maybeFlush();

      // A write for this key is still settling — honour it before the backend
      // (Next's documented set/get contract; also collapses duplicate origin work).
      const pending = await writes.readPending(cacheKey);
      if (pending) {
        telemetry.record('get', 'hit');
        return pending;
      }

      if (disabled) {
        telemetry.record('get', 'skip_disabled');
        return undefined;
      }

      if (!breaker.shouldAttempt()) {
        telemetry.record('get', 'skip_circuit_open');
        return undefined;
      }

      try {
        const entry = await backend.get(cacheKey, softTags);
        breaker.recordSuccess();
        telemetry.record('get', entry ? 'hit' : 'miss');
        return entry;
      } catch (error) {
        breaker.recordFailure();
        telemetry.record('get', 'failure');
        // A read failure is a MISS, never a throw: the route recomputes.
        logger.warn(
          `[resilient-remote-cache] get failed, treating as miss: ${describeError(error)}`
        );
        return undefined;
      }
    },

    async set(cacheKey, pendingEntry) {
      telemetry.maybeFlush();
      // Always resolves — see remote-cache-write-pipeline.mjs.
      await writes.write(cacheKey, pendingEntry);
    },

    async refreshTags() {
      if (disabled) {
        telemetry.record('refresh_tags', 'skip_disabled');
        return;
      }

      if (!breaker.shouldAttempt()) {
        telemetry.record('refresh_tags', 'skip_circuit_open');
        return;
      }

      try {
        await backend.refreshTags();
        breaker.recordSuccess();
        telemetry.record('refresh_tags', 'success');
      } catch (error) {
        breaker.recordFailure();
        telemetry.record('refresh_tags', 'failure');
        logger.warn(
          `[resilient-remote-cache] refreshTags failed: ${describeError(error)}`
        );
      }
    },

    async getExpiration(tags) {
      if (disabled || !breaker.shouldAttempt()) {
        telemetry.record(
          'get_expiration',
          disabled ? 'skip_disabled' : 'skip_circuit_open'
        );
        // Infinity = "check the soft tags in get() instead" (Next's contract).
        // get() is miss-only in this state, so entries are recomputed, never
        // served stale.
        return Number.POSITIVE_INFINITY;
      }

      try {
        const expiration = await backend.getExpiration(tags);
        breaker.recordSuccess();
        telemetry.record('get_expiration', 'success');
        return expiration;
      } catch (error) {
        breaker.recordFailure();
        telemetry.record('get_expiration', 'failure');
        logger.warn(
          `[resilient-remote-cache] getExpiration failed: ${describeError(error)}`
        );
        // Fail toward freshness. Returning 0 would mean "these tags were never
        // revalidated", letting a busted entry be served as fresh; Infinity
        // defers the decision to get(), which degrades to a miss.
        return Number.POSITIVE_INFINITY;
      }
    },

    async updateTags(tags, durations) {
      // Deliberately NOT gated on the circuit breaker or the kill switch.
      // Invalidation is correctness, not throughput: per the inventory's §8
      // correction, every site on this handler depends on `revalidateTag`
      // reaching the shared store. Volume is negligible (admin mutations), so
      // there is nothing to protect the backend from here.
      try {
        if (durations) {
          await backend.updateTags(tags, durations);
        } else {
          await backend.updateTags(tags);
        }
        telemetry.record('update_tags', 'success');
      } catch (error) {
        telemetry.record('update_tags', 'failure');
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
