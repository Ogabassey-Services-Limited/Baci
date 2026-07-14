// @ts-check

/**
 * Byte-capped buffering for `CacheEntry` values.
 *
 * `CacheEntry.value` is a single-use `ReadableStream<Uint8Array>` which, per
 * Next's own CacheHandler docs, "can error and only have partial data". Two
 * consequences drive this module:
 *
 *  1. To enforce a size cap we have to *drain* the stream — there is no length
 *     to inspect up front. Having drained it, we must hand the backend a FRESH
 *     stream, and we must be able to rebuild one per reader (a concurrent
 *     `get()` on an in-flight `set()` needs its own).
 *  2. Every failure mode here — a rejected pending entry (failed render), a
 *     stream that errors mid-flight, an oversized payload — must be reported as
 *     a VALUE, never thrown. A throw would propagate into the promise Next
 *     awaits after the response is already sent (plan §4.4).
 *
 * Plain ESM, dependency-free — Node imports this directly (see
 * `remote-cache-handler.mjs`).
 *
 * @typedef {import('./remote-cache-types.mjs').CacheEntry} CacheEntry
 *
 * @typedef {{ status: 'ok', entry: CacheEntry, chunks: Uint8Array[], bytes: number }} BufferOk
 * @typedef {{ status: 'oversized', bytes: number }} BufferOversized
 * @typedef {{ status: 'stream_error', error: unknown }} BufferStreamError
 * @typedef {BufferOk | BufferOversized | BufferStreamError} BufferResult
 */

/** 1 MiB. See `remote-cache-handler.mjs` for the payload evidence behind this. */
export const DEFAULT_MAX_ITEM_BYTES = 1_048_576;

/**
 * Cancelling a reader is best-effort: we have already decided to discard this
 * entry, so a failure to cancel changes nothing and must never surface.
 *
 * @returns {undefined}
 */
const ignoreCancelFailure = () => undefined;

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
 * Drains a pending cache entry into memory, refusing anything over `maxBytes`.
 *
 * @param {CacheEntry | Promise<CacheEntry>} pendingEntry
 * @param {number} [maxBytes]
 * @returns {Promise<BufferResult>} Never rejects.
 */
export async function bufferCacheEntry(
  pendingEntry,
  maxBytes = DEFAULT_MAX_ITEM_BYTES
) {
  /** @type {CacheEntry} */
  let entry;
  try {
    // The framework hands us a *pending* entry: a failed render rejects it.
    entry = await pendingEntry;
  } catch (error) {
    return { status: 'stream_error', error };
  }

  if (!entry || typeof entry !== 'object' || !entry.value) {
    return {
      status: 'stream_error',
      error: new Error('Malformed cache entry'),
    };
  }

  /** @type {ReadableStreamDefaultReader<Uint8Array>} */
  let reader;
  try {
    // `getReader()` throws SYNCHRONOUSLY on an already-locked or already-consumed
    // stream. That must never escape to the caller — this function's whole
    // contract is that failure is a VALUE, not a throw.
    reader = entry.value.getReader();
  } catch (error) {
    return { status: 'stream_error', error };
  }

  /** @type {Uint8Array[]} */
  const chunks = [];
  let bytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      bytes += value.byteLength;
      if (bytes > maxBytes) {
        // Stop early: never drain a producer we have already decided to drop.
        await reader.cancel().catch(ignoreCancelFailure);
        return { status: 'oversized', bytes };
      }
      chunks.push(value);
    }
  } catch (error) {
    // A stream that errors mid-flight leaves us with partial data. Discard it —
    // a truncated cache entry is worse than no cache entry.
    await reader.cancel().catch(ignoreCancelFailure);
    return { status: 'stream_error', error };
  }

  return {
    status: 'ok',
    entry: createEntryFromChunks(entry, chunks),
    chunks,
    bytes,
  };
}
