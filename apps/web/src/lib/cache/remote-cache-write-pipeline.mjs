// @ts-check

import {
  bufferCacheEntry,
  createEntryFromChunks,
} from './remote-cache-entry-buffer.mjs';

/**
 * The cache WRITE path — the one that kills processes.
 *
 * Next fires `set()` and pushes the promise onto `pendingRevalidateWrites`,
 * awaiting it only after the response is already on the wire. Every failure mode
 * on this path (a rejected pending entry, a stream that errors, an oversized
 * payload, a 502/503 from the backend) must therefore terminate in a RESOLVED
 * promise. See `resilient-remote-cache-handler.mjs` for the full §4.4 rationale.
 *
 * It also owns the in-flight coordination Next's contract requires: "If a `get`
 * for the same cache key is called before the pending entry is complete, the
 * cache handler must wait for the `set` operation to finish, before returning
 * the entry, instead of returning undefined."
 *
 * @typedef {import('./remote-cache-types.mjs').CacheEntry} CacheEntry
 * @typedef {import('./remote-cache-types.mjs').CacheHandler} CacheHandler
 * @typedef {import('./remote-cache-telemetry.mjs').TelemetryLogger} TelemetryLogger
 * @typedef {import('./remote-cache-telemetry.mjs').CacheTelemetry} CacheTelemetry
 * @typedef {import('./remote-cache-circuit-breaker.mjs').CircuitBreaker} CircuitBreaker
 *
 * @typedef {{ entry: CacheEntry, chunks: Uint8Array[] }} BufferedEntry
 *
 * @typedef {object} WritePipelineOptions
 * @property {CacheHandler} backend
 * @property {CircuitBreaker} breaker Write-path breaker (independent of reads).
 * @property {CacheTelemetry} telemetry
 * @property {TelemetryLogger} logger
 * @property {number} maxItemBytes
 * @property {boolean} disabled
 * @property {() => number} [now]
 * @property {number} [maxPendingAgeMs]
 *
 * @typedef {object} WritePipeline
 * @property {(cacheKey: string, pendingEntry: Promise<CacheEntry>) => Promise<void>} write
 * @property {(cacheKey: string) => Promise<CacheEntry | undefined>} readPending
 */

/**
 * How long a still-settling write may be served from the in-memory buffer.
 *
 * The buffer exists only to satisfy Next's set/get contract for the brief window
 * while a write lands. If the shared write HANGS, the key would otherwise never
 * leave the map and every later get() would be served from memory — bypassing
 * expiration and tag checks, so a hung write could shadow an invalidation
 * indefinitely. Past this age we stop serving it and fall through to the store.
 */
export const DEFAULT_MAX_PENDING_AGE_MS = 5_000;

/**
 * @param {unknown} error
 * @returns {string}
 */
function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {WritePipelineOptions} options
 * @returns {WritePipeline}
 */
export function createWritePipeline(options) {
  const { backend, breaker, telemetry, logger, maxItemBytes, disabled } =
    options;
  const now = options.now ?? Date.now;
  const maxPendingAgeMs = options.maxPendingAgeMs ?? DEFAULT_MAX_PENDING_AGE_MS;

  /**
   * @typedef {{ buffering: Promise<BufferedEntry | undefined>, startedAt: number }} PendingWrite
   * @type {Map<string, PendingWrite>}
   */
  const pendingWrites = new Map();

  /**
   * Drain + size-gate the entry. Never rejects, whatever the entry does.
   *
   * @param {Promise<CacheEntry>} pendingEntry
   * @returns {Promise<BufferedEntry | undefined>}
   */
  async function bufferAndGate(pendingEntry) {
    const result = await bufferCacheEntry(pendingEntry, maxItemBytes);

    if (result.status === 'oversized') {
      telemetry.record('set', 'skip_oversized');
      logger.warn(
        `[resilient-remote-cache] refusing oversized entry: ${result.bytes} bytes > ${maxItemBytes} limit`
      );
      return undefined;
    }

    if (result.status === 'stream_error') {
      telemetry.record('set', 'failure');
      logger.warn(
        `[resilient-remote-cache] entry stream failed, skipping write: ${describeError(result.error)}`
      );
      return undefined;
    }

    return { entry: result.entry, chunks: result.chunks };
  }

  return {
    async write(cacheKey, pendingEntry) {
      const buffering = bufferAndGate(pendingEntry);
      /** @type {PendingWrite} */
      const record = { buffering, startedAt: now() };
      pendingWrites.set(cacheKey, record);

      try {
        const buffered = await buffering;
        if (!buffered) return;

        if (disabled) {
          telemetry.record('set', 'skip_disabled');
          return;
        }

        if (!breaker.shouldAttempt()) {
          telemetry.record('set', 'skip_circuit_open');
          return;
        }

        try {
          await backend.set(
            cacheKey,
            Promise.resolve(
              createEntryFromChunks(buffered.entry, buffered.chunks)
            )
          );
          breaker.recordSuccess();
          telemetry.record('set', 'write');
        } catch (error) {
          breaker.recordFailure();
          telemetry.record('set', 'failure');
          // ⚠️ THE FIX. This `catch` is the whole point of the adapter: the
          // promise Next awaits AFTER the response was sent now RESOLVES
          // instead of becoming an unhandled rejection + exit 128.
          logger.warn(
            `[resilient-remote-cache] set failed, dropping write: ${describeError(error)}`
          );
        }
      } finally {
        // Identity-guarded: a newer write for the same key must not be evicted
        // by an older one settling late.
        if (pendingWrites.get(cacheKey) === record) {
          pendingWrites.delete(cacheKey);
        }
      }
    },

    /**
     * Serves a `get()` whose key has a still-settling `set()`. Returns a FRESH
     * stream (the caller may not consume the buffered chunks).
     *
     * Age-bounded: a write that hangs must not shadow the shared store — and
     * therefore an invalidation — forever. See DEFAULT_MAX_PENDING_AGE_MS.
     */
    async readPending(cacheKey) {
      const record = pendingWrites.get(cacheKey);
      if (!record) return undefined;

      if (now() - record.startedAt >= maxPendingAgeMs) {
        // Stop shadowing: drop it and let the caller consult the shared store,
        // which is the only thing that can honour a tag bust.
        if (pendingWrites.get(cacheKey) === record) {
          pendingWrites.delete(cacheKey);
        }
        telemetry.record('get', 'skip_stale_pending');
        return undefined;
      }

      const buffered = await record.buffering;
      if (!buffered) return undefined;

      return createEntryFromChunks(buffered.entry, buffered.chunks);
    },
  };
}
