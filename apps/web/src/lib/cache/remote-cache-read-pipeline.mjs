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
 *  2. the subsystem is TRUSTED — `refreshTags()`/`getExpiration()`/`updateTags()`
 *     have not failed, so this instance's tag state can actually be relied upon;
 *  3. the read circuit is closed;
 *  4. any in-flight write to this key has settled (so we read post-write state,
 *     and never serve an unchecked in-memory buffer — see the write pipeline);
 *  5. the backend answers within the deadline (Invariant B);
 *  6. the entry's value stream can be fully read, **within the deadline**, and
 *     is within the size cap.
 *
 * If any of those fails the read becomes a MISS and the route recomputes from
 * the origin. These are correctness requirements, not optimisations: a slow
 * correct page beats a fast wrong one.
 *
 * Ordering note (1-3 before 4): the cheap synchronous gates run BEFORE we await
 * anything. If the read is going to miss anyway, there is no reason to first
 * wait on an in-flight write.
 *
 * (6) deserves a note. `CacheEntry.value` is a stream that, per Next's own docs,
 * "can error and only have partial data" — and it can also simply STALL. Handing
 * such a stream straight to Next converts a cache-backend failure into a
 * RENDER/RSC error, or hangs the request forever. So we drain and validate the
 * entry first — bounded by both the size cap and the deadline — and only then
 * hand back a fresh, known-good stream.
 *
 * @typedef {import('./remote-cache-types.mjs').CacheEntry} CacheEntry
 * @typedef {import('./remote-cache-types.mjs').CacheHandler} CacheHandler
 * @typedef {import('./remote-cache-telemetry.mjs').TelemetryLogger} TelemetryLogger
 * @typedef {import('./remote-cache-telemetry.mjs').CacheTelemetry} CacheTelemetry
 * @typedef {import('./remote-cache-breakers.mjs').CacheBreakers} CacheBreakers
 * @typedef {import('./remote-cache-trust.mjs').CacheTrust} CacheTrust
 * @typedef {import('./remote-cache-write-pipeline.mjs').WritePipeline} WritePipeline
 *
 * @typedef {object} ReadPipelineOptions
 * @property {CacheHandler} backend
 * @property {CacheBreakers} breakers
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
    breakers,
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
      const breaker = breakers('get');

      /* --- cheap synchronous gates first: never pay for a read we won't do --- */

      if (disabled) {
        telemetry.record('get', 'skip_disabled');
        return undefined;
      }

      // INVARIANT A chokepoint. If refreshTags()/getExpiration()/updateTags()
      // failed, this instance's tag state is unreliable, so a hit here could be
      // an entry that was already invalidated. We cannot verify it ⇒ don't serve it.
      if (!trust.isTrusted()) {
        telemetry.record('get', 'skip_untrusted');
        return undefined;
      }

      if (!breaker.shouldAttempt()) {
        telemetry.record('get', 'skip_circuit_open');
        return undefined;
      }

      /* --- now the awaits --- */

      // Next's contract: wait for an in-flight write to the same key. We wait,
      // then re-read the STORE — we never serve the write's in-memory buffer,
      // which has been checked against no tag manifest at all.
      await writes.awaitPending(cacheKey);

      /** @type {CacheEntry | undefined} */
      let entry;
      try {
        entry = await withTimeout(
          () => backend.get(cacheKey, softTags),
          backendTimeoutMs,
          'get'
        );
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
        // A miss is a healthy answer — the backend responded.
        breaker.recordSuccess();
        telemetry.record('get', 'miss');
        return undefined;
      }

      // Validate the payload BEFORE Next consumes it, and BEFORE we call this
      // read a success. A stream that errors or stalls IS a backend failure:
      // recording success right after `backend.get()` resolved (as we used to)
      // meant repeated corrupt entries kept the failure count pinned at one, and
      // we hammered a broken backend forever.
      const buffered = await bufferCacheEntry(
        entry,
        maxItemBytes,
        backendTimeoutMs
      );

      if (buffered.status === 'oversized') {
        // LOCAL fault (our own size policy): nothing above the cap should exist,
        // so this is a legacy/foreign entry. The BACKEND behaved perfectly — it
        // answered — so this is a miss, never a breaker failure.
        breaker.recordSuccess();
        telemetry.record('get', 'skip_oversized');
        logger.warn(
          `[resilient-remote-cache] cached entry exceeds ${maxItemBytes} bytes, treating as miss`
        );
        return undefined;
      }

      if (buffered.status === 'timeout' || buffered.status === 'stream_error') {
        // BACKEND fault — and this is the mirror image of the write path, where
        // the identical helper is a LOCAL fault. The difference is who OWNS the
        // stream: here it came out of `backend.get()`, so a stalled or truncated
        // body is the backend failing. On the write path the stream is the
        // framework's RSC render output, so an identical failure is NOT the
        // backend's fault and must not open its circuit. A breaker may only ever
        // count faults of the thing it protects.
        breaker.recordFailure();
        telemetry.record(
          'get',
          buffered.status === 'timeout' ? 'timeout' : 'skip_stream_error'
        );
        logger.warn(
          `[resilient-remote-cache] cached entry stream failed, treating as miss: ${describeError(buffered.error)}`
        );
        return undefined;
      }

      breaker.recordSuccess();
      telemetry.record('get', 'hit');
      return buffered.entry;
    },
  };
}
