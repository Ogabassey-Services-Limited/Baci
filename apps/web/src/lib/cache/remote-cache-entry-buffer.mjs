// @ts-check

import {
  CacheBackendTimeoutError,
  DEFAULT_BACKEND_TIMEOUT_MS,
  withTimeout,
} from './remote-cache-timeout.mjs';

/**
 * Byte-capped, DEADLINE-BOUNDED buffering for `CacheEntry` values.
 *
 * `CacheEntry.value` is a single-use `ReadableStream<Uint8Array>` which, per
 * Next's own CacheHandler docs, "can error and only have partial data". Three
 * consequences drive this module:
 *
 *  1. To enforce a size cap we must *drain* the stream — there is no length to
 *     inspect up front. Having drained it we must hand the backend (or Next) a
 *     FRESH stream, and be able to rebuild one per reader.
 *
 *  2. Every failure mode — a rejected pending entry (failed render), a stream
 *     that errors mid-flight, an oversized payload — must be reported as a
 *     VALUE, never thrown. A throw would propagate into the promise Next awaits
 *     after the response is already sent (plan §4.4).
 *
 *  3. **A stream can STALL rather than fail.** `reader.read()` awaited with no
 *     deadline is a hole straight through Invariant B: a cache hit whose body
 *     never arrives would hang the storefront request forever — `get()` would
 *     never settle, the breaker would never learn, and (because the same helper
 *     runs before `backend.set()`) a write could wedge the same way. So the
 *     whole buffer operation runs against a single deadline, and every
 *     individual `read()` is raced against the REMAINING budget. A stall is a
 *     failure: it becomes a miss and feeds the circuit breaker.
 *
 * Plain ESM, dependency-free — Node imports this directly (see
 * `remote-cache-handler.mjs`).
 *
 * @typedef {import('./remote-cache-types.mjs').CacheEntry} CacheEntry
 *
 * @typedef {{ status: 'ok', entry: CacheEntry, chunks: Uint8Array[], bytes: number }} BufferOk
 * @typedef {{ status: 'oversized', bytes: number }} BufferOversized
 * @typedef {{ status: 'stream_error', error: unknown }} BufferStreamError
 * @typedef {{ status: 'timeout', error: unknown }} BufferTimeout
 * @typedef {BufferOk | BufferOversized | BufferStreamError | BufferTimeout} BufferResult
 */

/** 1 MiB. See `remote-cache-handler.mjs` for the payload evidence behind this. */
export const DEFAULT_MAX_ITEM_BYTES = 1_048_576;

/**
 * Cancels a reader FIRE-AND-FORGET.
 *
 * Deliberately NOT awaited. We have already decided to discard this entry, so a
 * failed cancel changes nothing — but a stalled backend's cancellation hook can
 * itself block on that same sick backend. Awaiting it would put an UNBOUNDED
 * wait on the very timeout path that exists to escape the stall, so `get()` and
 * `set()` could still wedge despite `BACI_REMOTE_CACHE_TIMEOUT_MS`. We must not
 * hand the deadline back to the thing that already missed it.
 *
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader
 * @returns {void}
 */
function cancelQuietly(reader) {
  try {
    void reader.cancel().catch(() => undefined);
  } catch {
    // `cancel()` can also throw synchronously on an already-errored stream.
  }
}

/**
 * Rebuilds a `CacheEntry` around a fresh stream over already-buffered chunks.
 * Safe to call repeatedly — each call yields an independent stream.
 *
 * @param {CacheEntry} entry Source of the metadata (tags/stale/expire/...).
 * @param {Uint8Array[]} chunks
 * @returns {CacheEntry}
 */
export function createEntryFromChunks(entry, chunks) {
  return {
    value: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    }),
    tags: entry.tags,
    stale: entry.stale,
    timestamp: entry.timestamp,
    expire: entry.expire,
    revalidate: entry.revalidate,
  };
}

/**
 * @param {unknown} error
 * @returns {'timeout' | 'stream_error'}
 */
function classify(error) {
  return error instanceof CacheBackendTimeoutError ? 'timeout' : 'stream_error';
}

/**
 * Drains a pending cache entry into memory, refusing anything over `maxBytes`
 * and anything that takes longer than `timeoutMs` in total.
 *
 * @param {CacheEntry | Promise<CacheEntry>} pendingEntry
 * @param {number} [maxBytes]
 * @param {number} [timeoutMs] Budget for the WHOLE operation (entry + stream).
 * @returns {Promise<BufferResult>} Never rejects.
 */
export async function bufferCacheEntry(
  pendingEntry,
  maxBytes = DEFAULT_MAX_ITEM_BYTES,
  timeoutMs = DEFAULT_BACKEND_TIMEOUT_MS
) {
  const deadline = Date.now() + timeoutMs;
  /** @returns {number} */
  const remaining = () => deadline - Date.now();

  /** @type {CacheEntry} */
  let entry;
  try {
    // The framework hands us a *pending* entry: a failed render rejects it — and
    // a hung render never settles it at all, so this needs the deadline too.
    entry = await withTimeout(
      () => Promise.resolve(pendingEntry),
      Math.max(remaining(), 1),
      'pending_entry'
    );
  } catch (error) {
    return { status: classify(error), error };
  }

  if (!entry || typeof entry !== 'object' || !entry.value) {
    return {
      status: 'stream_error',
      error: new Error('Malformed cache entry: missing value stream'),
    };
  }

  /** @type {ReadableStreamDefaultReader<Uint8Array>} */
  let reader;
  try {
    // `getReader()` throws SYNCHRONOUSLY on an already-locked or already-consumed
    // stream. That must never escape — failure here is a VALUE, not a throw.
    reader = entry.value.getReader();
  } catch (error) {
    return { status: 'stream_error', error };
  }

  /** @type {Uint8Array[]} */
  const chunks = [];
  let bytes = 0;

  try {
    for (;;) {
      const budget = remaining();
      if (budget <= 0) {
        throw new CacheBackendTimeoutError('stream_read', timeoutMs);
      }

      // A stalled chunk must not hang the request — race each read against what
      // is left of the overall budget.
      const { done, value } = await withTimeout(
        () => reader.read(),
        budget,
        'stream_read'
      );
      if (done) break;
      if (!value) continue;

      bytes += value.byteLength;
      if (bytes > maxBytes) {
        // Stop early: never drain a producer we have already decided to drop.
        cancelQuietly(reader);
        return { status: 'oversized', bytes };
      }
      chunks.push(value);
    }
  } catch (error) {
    // A stream that errors — or stalls — mid-flight leaves us with partial data.
    // Discard it: a truncated cache entry is worse than no cache entry.
    cancelQuietly(reader);
    return { status: classify(error), error };
  }

  return {
    status: 'ok',
    entry: createEntryFromChunks(entry, chunks),
    chunks,
    bytes,
  };
}
