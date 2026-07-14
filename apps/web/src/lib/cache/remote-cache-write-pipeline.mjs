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
 * @property {CircuitBreaker} breaker
 * @property {CacheTelemetry} telemetry
 * @property {TelemetryLogger} logger
 * @property {number} maxItemBytes
 * @property {boolean} disabled
 *
 * @typedef {object} WritePipeline
 * @property {(cacheKey: string, pendingEntry: Promise<CacheEntry>) => Promise<void>} write
 * @property {(cacheKey: string) => Promise<CacheEntry | undefined>} readPending
 */

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

  /** @type {Map<string, Promise<BufferedEntry | undefined>>} */
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
      pendingWrites.set(cacheKey, buffering);

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
        pendingWrites.delete(cacheKey);
      }
    },

    /**
     * Serves a `get()` whose key has a still-settling `set()`. Returns a FRESH
     * stream (the caller may not consume the buffered chunks).
     */
    async readPending(cacheKey) {
      const buffering = pendingWrites.get(cacheKey);
      if (!buffering) return undefined;

      const buffered = await buffering;
      if (!buffered) return undefined;

      return createEntryFromChunks(buffered.entry, buffered.chunks);
    },
  };
}
