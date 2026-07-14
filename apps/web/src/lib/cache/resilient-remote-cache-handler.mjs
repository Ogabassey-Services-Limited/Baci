// @ts-check

import { createCacheBreakers } from './remote-cache-breakers.mjs';
import {
  DEFAULT_COOLDOWN_MS,
  DEFAULT_FAILURE_THRESHOLD,
} from './remote-cache-circuit-breaker.mjs';
import { DEFAULT_MAX_ITEM_BYTES } from './remote-cache-entry-buffer.mjs';
import { createReadPipeline } from './remote-cache-read-pipeline.mjs';
import { createTagPipeline } from './remote-cache-tag-pipeline.mjs';
import { createCacheTelemetry } from './remote-cache-telemetry.mjs';
import { DEFAULT_BACKEND_TIMEOUT_MS } from './remote-cache-timeout.mjs';
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

  // PER-LEG breakers. Failure accounting has to be per-operation, because that
  // is the granularity at which a backend actually fails: a healthy leg's
  // successes must never reset a sick leg's failure count. See
  // `remote-cache-breakers.mjs` for the two bugs that taught us this.
  const breakers = createCacheBreakers({ failureThreshold, cooldownMs, now });

  const telemetry = createCacheTelemetry({ logger, flushIntervalMs, now });
  // NOT cooldownMs: the breaker shields a sick backend from load, while distrust
  // shifts load onto the origin. Opposite dials — see DEFAULT_DISTRUST_MS.
  const trust = createCacheTrust({ distrustMs, now });

  const writes = createWritePipeline({
    backend,
    breaker: breakers('set'),
    telemetry,
    logger,
    maxItemBytes,
    disabled,
    backendTimeoutMs,
    now,
  });

  const reads = createReadPipeline({
    backend,
    breakers,
    trust,
    telemetry,
    logger,
    writes,
    maxItemBytes,
    disabled,
    backendTimeoutMs,
  });

  const tags = createTagPipeline({
    backend,
    breakers,
    trust,
    telemetry,
    logger,
    disabled,
    backendTimeoutMs,
    cooldownMs,
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
      await tags.refreshTags();
    },

    async getExpiration(softTags) {
      return await tags.getExpiration(softTags);
    },

    async updateTags(softTags, durations) {
      await tags.updateTags(softTags, durations);
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
