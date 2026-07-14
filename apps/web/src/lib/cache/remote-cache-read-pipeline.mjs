// @ts-check

import { bufferCacheEntry } from './remote-cache-entry-buffer.mjs';
import {
  CacheBackendTimeoutError,
  withTimeout,
} from './remote-cache-timeout.mjs';

/**
 * The cache READ path, and the single chokepoint enforcing Invariant A:
 * **degrade toward the ORIGIN, never toward unverified data.**
 *
 * A read may only return an entry when EVERY one of these holds:
 *
 *  1. the cache is not disabled;
 *  2. any in-flight write to this key has settled (so we read post-write state,
 *     and never serve an unchecked in-memory buffer — see the write pipeline);
 *  3. the subsystem is TRUSTED — `refreshTags()`/`getExpiration()` have not
 *     failed, so this instance's tag state can actually be relied upon;
 *  4. the read circuit is closed;
 *  5. the backend answers within the deadline (Invariant B);
 *  6. the entry's value stream can be fully read and is within the size cap.
 *
 * If any of those fails the read becomes a MISS and the route recomputes from
 * the origin. Every one of these is a correctness requirement, not an
 * optimisation: a slow correct page beats a fast wrong one.
 *
 * (6) deserves a note. `CacheEntry.value` is a stream that, per Next's own
 * CacheHandler docs, "can error and only have partial data". If we hand that
 * stream straight to Next and it then errors mid-consumption, a cache-backend
 * failure has been converted into a RENDER/RSC error — the exact
 * transient-failure-becomes-user-visible-breakage this plan forbids. So we drain
 * and validate the entry first (bounded by the same size cap we enforce on
 * writes) and only then hand back a fresh, known-good stream.
 *
 * @typedef {import('./remote-cache-types.mjs').CacheEntry} CacheEntry
 * @typedef {import('./remote-cache-types.mjs').CacheHandler} CacheHandler
 * @typedef {import('./remote-cache-telemetry.mjs').TelemetryLogger} TelemetryLogger
 * @typedef {import('./remote-cache-telemetry.mjs').CacheTelemetry} CacheTelemetry
 * @typedef {import('./remote-cache-circuit-breaker.mjs').CircuitBreaker} CircuitBreaker
 * @typedef {import('./remote-cache-trust.mjs').CacheTrust} CacheTrust
 * @typedef {import('./remote-cache-write-pipeline.mjs').WritePipeline} WritePipeline
 *
 * @typedef {object} ReadPipelineOptions
 * @property {CacheHandler} backend
 * @property {CircuitBreaker} breaker Read-path breaker (independent of writes).
 * @property {CacheTrust} trust
 * @property {CacheTelemetry} telemetry
 * @property {TelemetryLogger} logger
 * @property {WritePipeline} writes
 * @property {number} maxItemBytes
 * @property {boolean} disabled
 * @property {number} backendTimeoutMs
 *
 * @typedef {object} ReadPipeline
 * @property {(cacheKey: string, softTags: string[]) => Promise<CacheEntry | undefined>} read
 */

/**
 * @param {unknown} error
 * @returns {string}
 */
function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {ReadPipelineOptions} options
 * @returns {ReadPipeline}
 */
export function createReadPipeline(options) {
  const {
    backend,
    breaker,
    trust,
    telemetry,
    logger,
    writes,
    maxItemBytes,
    disabled,
    backendTimeoutMs,
  } = options;

  return {
    async read(cacheKey, softTags) {
      if (disabled) {
        telemetry.record('get', 'skip_disabled');
        return undefined;
      }

      // Next's contract: wait for an in-flight write to the same key. We wait,
      // then re-read the STORE — we never serve the write's in-memory buffer,
      // which has been checked against no tag manifest at all.
      await writes.awaitPending(cacheKey);

      // INVARIANT A chokepoint. If refreshTags()/getExpiration() failed, this
      // instance's tag state is unreliable, so a hit here could be an entry that
      // was already invalidated. We cannot verify it ⇒ we must not serve it.
      if (!trust.isTrusted()) {
        telemetry.record('get', 'skip_untrusted');
        return undefined;
      }

      if (!breaker.shouldAttempt()) {
        telemetry.record('get', 'skip_circuit_open');
        return undefined;
      }

      /** @type {CacheEntry | undefined} */
      let entry;
      try {
        entry = await withTimeout(
          () => backend.get(cacheKey, softTags),
          backendTimeoutMs,
          'get'
        );
        breaker.recordSuccess();
      } catch (error) {
        breaker.recordFailure();
        telemetry.record(
          'get',
          error instanceof CacheBackendTimeoutError ? 'timeout' : 'failure'
        );
        // A read failure is a MISS, never a throw: the route recomputes.
        logger.warn(
          `[resilient-remote-cache] get failed, treating as miss: ${describeError(error)}`
        );
        return undefined;
      }

      if (!entry) {
        telemetry.record('get', 'miss');
        return undefined;
      }

      // Validate the payload BEFORE Next starts consuming it, so a truncated or
      // erroring stream degrades to a clean miss instead of an RSC render error.
      const buffered = await bufferCacheEntry(entry, maxItemBytes);

      if (buffered.status === 'oversized') {
        // Nothing above the cap should exist (we refuse to write them), so this
        // is a legacy or foreign entry. We cannot vouch for it ⇒ miss.
        telemetry.record('get', 'skip_oversized');
        logger.warn(
          `[resilient-remote-cache] cached entry exceeds ${maxItemBytes} bytes, treating as miss`
        );
        return undefined;
      }

      if (buffered.status === 'stream_error') {
        // The backend failed mid-stream. That is a backend failure — feed the
        // breaker — and a MISS, never a half-rendered page.
        breaker.recordFailure();
        telemetry.record('get', 'skip_stream_error');
        logger.warn(
          `[resilient-remote-cache] cached entry stream failed, treating as miss: ${describeError(buffered.error)}`
        );
        return undefined;
      }

      telemetry.record('get', 'hit');
      return buffered.entry;
    },
  };
}
