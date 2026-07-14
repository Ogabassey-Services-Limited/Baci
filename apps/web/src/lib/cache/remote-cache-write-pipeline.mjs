// @ts-check

import {
  bufferCacheEntry,
  createEntryFromChunks,
} from './remote-cache-entry-buffer.mjs';
import {
  CacheBackendTimeoutError,
  withTimeout,
} from './remote-cache-timeout.mjs';

/**
 * The cache WRITE path — the one that kills processes.
 *
 * Next fires `set()` and pushes the promise onto `pendingRevalidateWrites`,
 * awaiting it only after the response is already on the wire. Every failure mode
 * on this path must therefore terminate in a RESOLVED promise:
 *
 *  - a rejected pending entry (failed render),
 *  - a value stream that errors mid-flight,
 *  - an oversized payload,
 *  - a 502/503 from the backend, and — crucially —
 *  - a backend that simply HANGS. A hang never reaches `catch`/`finally`, so
 *    without a deadline the promise Next awaits stays unresolved forever, the
 *    write circuit never opens, and the pending record is never cleaned. Every
 *    backend call is raced with a timeout (Invariant B) and a timeout counts as
 *    a breaker failure.
 *
 * ## FAULT ATTRIBUTION — a breaker may only count faults of the thing it protects
 *
 * The write breaker exists to protect the cache BACKEND from being hammered
 * while it is sick. It must therefore count **only** faults of the backend
 * interaction — `backend.set()` rejecting or timing out.
 *
 * Two things it must NOT count, because they are LOCAL faults:
 *
 *  - **The `pendingEntry` stream.** That stream is the FRAMEWORK's — it is the
 *    RSC render output Next hands us. If it stalls or errors, a React render is
 *    slow or crashed. The cache backend may be perfectly healthy. Charging that
 *    to the write breaker would let an unrelated render bug OPEN the circuit and
 *    disable caching platform-wide — the resilience layer amplifying the very
 *    kind of failure it exists to contain.
 *  - **Our own size policy.** An oversized entry is us refusing to write; the
 *    backend never saw it.
 *
 * Both skip the write quietly and `releaseProbe()` (giving back a half-open slot
 * without judging the backend either way).
 *
 * The mirror image holds on the READ path, and it points the other way: there,
 * the entry stream comes *from* `backend.get()`, so a stalled or truncated body
 * IS a backend fault and DOES count. Same rule, opposite conclusion — because the
 * owner of the stream is different.
 *
 * ## The pending map is a SYNCHRONISATION POINT, never a cache
 *
 * Next's contract: "If a `get` for the same cache key is called before the
 * pending entry is complete, the cache handler must wait for the `set` operation
 * to finish, before returning the entry, instead of returning undefined."
 *
 * We satisfy the *wait* but deliberately do NOT serve the buffered entry.
 * Serving it would bypass the shared store's tag/expiration checks entirely: an
 * admin mutation can revalidate the tag while the write is in flight, and we
 * would hand back the pre-mutation value having checked nothing. Instead we wait
 * (bounded) for the write to settle and let the caller re-read the store — the
 * only thing that can honour a tag bust. That is Invariant A on the write path.
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
 * @property {number} backendTimeoutMs
 * @property {() => number} [now]
 *
 * @typedef {object} WritePipeline
 * @property {(cacheKey: string, pendingEntry: Promise<CacheEntry>) => Promise<void>} write
 * @property {(cacheKey: string) => Promise<boolean>} awaitPending Whether the
 * pending write settled before the deadline. A false result requires a miss.
 */

/**
 * @param {unknown} error
 * @returns {string}
 */
function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Marks a framework promise as handled. We are deliberately dropping the write,
 * so a later rejection is irrelevant — but it must never surface as an unhandled
 * rejection after the response has been sent.
 *
 * @returns {undefined}
 */
const swallowRejection = () => undefined;

/**
 * @param {WritePipelineOptions} options
 * @returns {WritePipeline}
 */
export function createWritePipeline(options) {
  const {
    backend,
    breaker,
    telemetry,
    logger,
    maxItemBytes,
    disabled,
    backendTimeoutMs,
  } = options;
  const now = options.now ?? Date.now;

  /**
   * @typedef {{ done: Promise<void>, startedAt: number }} PendingWrite
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
    const result = await bufferCacheEntry(
      pendingEntry,
      maxItemBytes,
      backendTimeoutMs
    );

    if (result.status === 'oversized') {
      // LOCAL fault (our own size policy) — see the attribution rule above.
      breaker.releaseProbe();
      telemetry.record('set', 'skip_oversized');
      logger.warn(
        `[resilient-remote-cache] refusing oversized entry: ${result.bytes} bytes > ${maxItemBytes} limit`
      );
      return undefined;
    }

    if (result.status === 'timeout' || result.status === 'stream_error') {
      // LOCAL fault. `pendingEntry` is the FRAMEWORK's stream — the RSC render
      // output handed to us by Next — so a stall or error here is a slow or
      // crashed React render, NOT a sick cache backend. Charging it to the write
      // breaker would let an unrelated render bug OPEN the circuit and disable
      // caching platform-wide while the backend was perfectly healthy: the
      // resilience layer amplifying a failure it was supposed to contain.
      //
      // Skip the write quietly and hand back any probe we were admitted with.
      breaker.releaseProbe();
      telemetry.record(
        'set',
        result.status === 'timeout'
          ? 'skip_render_timeout'
          : 'skip_render_error'
      );
      logger.warn(
        `[resilient-remote-cache] render stream failed, skipping write (NOT a backend fault): ${describeError(result.error)}`
      );
      return undefined;
    }

    return { entry: result.entry, chunks: result.chunks };
  }

  /**
   * @param {string} cacheKey
   * @param {Promise<CacheEntry>} pendingEntry
   * @returns {Promise<void>} Never rejects.
   */
  async function performWrite(cacheKey, pendingEntry) {
    // ⚠️ ATTACH A HANDLER BEFORE ANY EARLY RETURN.
    //
    // `pendingEntry` is the framework's promise. The cheap gates below can skip
    // the write without ever awaiting it — and if the render LATER rejects, that
    // promise has no handler attached, so Node raises an unhandled rejection
    // AFTER the response has already been sent. That is precisely the exit-128
    // process-kill this adapter exists to contain, reintroduced through the back
    // door by the skip paths. `bufferAndGate` attaches its own handler on the
    // paths that do await it; this covers every path that does not.
    Promise.resolve(pendingEntry).catch(swallowRejection);

    // CHEAP GATES FIRST. Draining and size-gating the entry is the expensive
    // part; doing it before checking whether we are even allowed to write meant
    // that during an outage (circuit open) — or with the kill switch on — every
    // write still paid the full buffer + size-gate cost for nothing.
    if (disabled) {
      telemetry.record('set', 'skip_disabled');
      return;
    }

    if (!breaker.shouldAttempt()) {
      telemetry.record('set', 'skip_circuit_open');
      return;
    }

    const buffered = await bufferAndGate(pendingEntry);
    if (!buffered) return;

    try {
      await withTimeout(
        () =>
          backend.set(
            cacheKey,
            Promise.resolve(
              createEntryFromChunks(buffered.entry, buffered.chunks)
            )
          ),
        backendTimeoutMs,
        'set'
      );
      breaker.recordSuccess();
      telemetry.record('set', 'write');
    } catch (error) {
      // ⚠️ THE FIX. The promise Next awaits AFTER the response was sent now
      // RESOLVES instead of becoming an unhandled rejection + exit 128. A
      // TIMEOUT lands here too, so a HUNG backend also opens the circuit rather
      // than wedging the write forever.
      breaker.recordFailure();
      telemetry.record(
        'set',
        error instanceof CacheBackendTimeoutError ? 'timeout' : 'failure'
      );
      logger.warn(
        `[resilient-remote-cache] set failed, dropping write: ${describeError(error)}`
      );
    }
  }

  return {
    async write(cacheKey, pendingEntry) {
      /** @type {() => void} */
      let settle = () => undefined;
      /** @type {Promise<void>} */
      const done = new Promise((resolve) => {
        settle = () => resolve();
      });
      /** @type {PendingWrite} */
      const record = { done, startedAt: now() };
      pendingWrites.set(cacheKey, record);

      try {
        await performWrite(cacheKey, pendingEntry);
      } finally {
        settle();
        // Identity-guarded: a newer write for the same key must not be evicted
        // by an older one settling late.
        if (pendingWrites.get(cacheKey) === record) {
          pendingWrites.delete(cacheKey);
        }
      }
    },

    async awaitPending(cacheKey) {
      const record = pendingWrites.get(cacheKey);
      if (!record) return true;

      try {
        // `performWrite` is already deadline-bounded, so `done` settles. This
        // race additionally guards a pending ENTRY (i.e. a render) that never
        // resolves — a hung write must not wedge every later read of that key.
        await withTimeout(() => record.done, backendTimeoutMs, 'await_pending');
        return true;
      } catch {
        telemetry.record('set', 'timeout');
        if (pendingWrites.get(cacheKey) === record) {
          pendingWrites.delete(cacheKey);
        }
        return false;
      }
    },
  };
}
