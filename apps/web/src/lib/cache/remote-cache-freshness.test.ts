// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createResilientRemoteCacheHandler } from './resilient-remote-cache-handler.mjs';

/**
 * Freshness semantics that depend on EXACTLY what Next 16.2.9 does with our
 * return values. Verified against `node_modules/next/dist`, not from memory.
 *
 * `use-cache-wrapper.js` (~1277-1320):
 *
 *     const lazyRefreshTags = workStore.refreshTagsByCacheKind.get(kind);
 *     if (lazyRefreshTags && !isResolvedLazyResult(lazyRefreshTags)) {
 *       await lazyRefreshTags;                                  // BEFORE get()
 *     }
 *     let entry;
 *     if (cacheHandler && !shouldForceRevalidate(...)) {
 *       entry = await cacheHandler.get(cacheHandlerKey, implicitTags);
 *     }
 *     if (entry) {
 *       let implicitTagsExpiration = 0;
 *       const lazyExpiration = workUnitStore.implicitTags.expirationsByCacheKind.get(kind);
 *       if (lazyExpiration) {
 *         const expiration = ... await lazyExpiration;          // AFTER get()
 *         if (expiration < Infinity) implicitTagsExpiration = expiration;
 *       }
 *       if (shouldDiscardCacheEntry(entry, ..., implicitTagsExpiration)) entry = undefined;
 *     }
 *
 * and `shouldDiscardCacheEntry` (1529):
 *
 *     if (entry.timestamp <= implicitTagsExpiration) return true;   // discard
 *
 * Two consequences drive the design:
 *
 *   1. `refreshTags` is awaited BEFORE `get()`, so a refreshTags failure CAN be
 *      made to gate the very same request's read.
 *   2. `getExpiration` is awaited AFTER `get()` and only when an entry exists.
 *      Returning `Infinity` leaves `implicitTagsExpiration` at 0, i.e. "implicit
 *      tags are NOT expired" — for the entry Next has ALREADY taken from us. A
 *      distrust flag can therefore only protect LATER reads; the current one is
 *      already through. But `implicitTagsExpiration` is consumed ONLY by that
 *      timestamp comparison, so returning a FINITE "now" makes Next discard the
 *      entry it just received. That is the lever we use.
 */

const encoder = new TextEncoder();

function makeEntry(body = 'cached', timestamp = 1_000) {
  return {
    value: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
    tags: ['products-m1'],
    stale: 300,
    timestamp,
    expire: 86_400,
    revalidate: 300,
  };
}

function makeBackend() {
  return {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    refreshTags: vi.fn().mockResolvedValue(undefined),
    getExpiration: vi.fn().mockResolvedValue(0),
    updateTags: vi.fn().mockResolvedValue(undefined),
  };
}

describe('freshness semantics against the real Next contract', () => {
  const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };

  describe('getExpiration (PRRT_kwDOQZgfis6Qmv0r)', () => {
    it('returns a FINITE timestamp on failure so Next discards the entry it just took', async () => {
      const backend = makeBackend();
      backend.getExpiration.mockRejectedValue(new Error('503'));
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        now: () => 5_000,
      });

      const expiration = await handler.getExpiration(['products-m1']);

      // Must be < Infinity, or Next's `if (expiration < Infinity)` filter drops
      // it, implicitTagsExpiration stays 0 ("implicit tags not expired"), and
      // the ALREADY RETURNED entry is served stale.
      expect(Number.isFinite(expiration)).toBe(true);
      expect(expiration).toBe(Number.MAX_SAFE_INTEGER);

      // Sanity-check the discard arithmetic Next will perform.
      const entry = makeEntry('stale', 1_000);
      expect(entry.timestamp <= expiration).toBe(true);
    });

    /**
     * Codex round 3 (`PRRT_kwDOQZgfis6QnKUU`). The comparison is
     * `entry.timestamp <= implicitTagsExpiration`, so a LARGER value discards
     * MORE. Returning `Date.now()` looked right but let a FUTURE-dated entry
     * survive — clock skew between instances, or a backend-supplied timestamp —
     * which is precisely the pre-invalidation entry we meant to drop.
     */
    it('discards even a FUTURE-dated entry when expiration is unverifiable', async () => {
      const backend = makeBackend();
      backend.getExpiration.mockRejectedValue(new Error('503'));
      const localNow = 5_000;
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        now: () => localNow,
      });

      const expiration = await handler.getExpiration(['products-m1']);

      // An entry written by an instance whose clock runs ahead of ours.
      const skewed = makeEntry('pre-invalidation', localNow + 60_000);
      expect(skewed.timestamp).toBeGreaterThan(localNow);
      // Under the old `clock()` answer this survived. It must not.
      expect(skewed.timestamp <= expiration).toBe(true);
    });

    /**
     * CodeRabbit `PRRT_kwDOQZgfis6QoB_y`. When the get_expiration circuit is OPEN
     * we skip the check entirely — so freshness is unverifiable, exactly as if
     * the check had failed. Without degrading trust the read pipeline would still
     * go to the backend for an entry Next is about to discard on the strength of
     * the UNVERIFIABLE_EXPIRATION we return: pointless load on a backend we
     * already believe is sick.
     */
    it('degrades trust when the expiration circuit is OPEN, so reads skip the backend entirely', async () => {
      const backend = makeBackend();
      backend.getExpiration.mockRejectedValue(new Error('503'));
      backend.get.mockImplementation(async () =>
        makeEntry('would-be-discarded')
      );
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        failureThreshold: 1,
        cooldownMs: 30_000,
        now: () => 0,
      });

      // Trip the get_expiration circuit.
      await handler.getExpiration(['products-m1']);
      expect(backend.getExpiration).toHaveBeenCalledTimes(1);

      // Now OPEN: the check is skipped...
      await expect(handler.getExpiration(['products-m1'])).resolves.toBe(
        Number.MAX_SAFE_INTEGER
      );
      expect(backend.getExpiration).toHaveBeenCalledTimes(1);

      // ...and the read must not bother the backend for an entry that would be
      // discarded anyway.
      await expect(handler.get('key-1', [])).resolves.toBeUndefined();
      expect(backend.get).not.toHaveBeenCalled();
    });

    it('passes the real expiration through when the backend answers', async () => {
      const backend = makeBackend();
      backend.getExpiration.mockResolvedValue(1_234);
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      await expect(handler.getExpiration(['products-m1'])).resolves.toBe(1_234);
    });

    it('does not poison a healthy build: a successful lookup keeps entries usable', async () => {
      // During `next build` the default in-memory handler answers 0 — every
      // entry stays reusable across the 2,939 prerendered pages.
      const backend = makeBackend();
      backend.getExpiration.mockResolvedValue(0);
      backend.get.mockImplementation(async () => makeEntry('build-cached'));
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      await expect(handler.getExpiration(['products-m1'])).resolves.toBe(0);
      await expect(handler.get('k', [])).resolves.toBeDefined();
    });
  });

  describe('pending write must never bypass invalidation (PRRT_kwDOQZgfis6Qmv0x)', () => {
    it('re-reads the shared store after an in-flight write instead of serving the buffer', async () => {
      // Scenario: an admin mutation revalidates the tag while a set() for the
      // same key is in flight. Serving our pre-mutation buffer would bypass the
      // tag/expiration check entirely. Next's own default waits for the pending
      // set and then consults the tag manifest — so we must consult the store.
      let releaseWrite: () => void = () => {};
      let signalWriteStarted: () => void = () => {};
      const writeStarted = new Promise<void>((resolve) => {
        signalWriteStarted = resolve;
      });
      const backend = makeBackend();
      backend.set.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            releaseWrite = resolve;
            signalWriteStarted();
          })
      );
      // The store, post-invalidation, no longer has the entry.
      backend.get.mockResolvedValue(undefined);

      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        backendTimeoutMs: 50,
      });

      const writing = handler.set(
        'key-1',
        Promise.resolve(makeEntry('pre-mutation'))
      );
      await writeStarted;
      // Concurrent read for the same key.
      const readPromise = handler.get('key-1', ['products-m1']);
      releaseWrite();

      // It must consult the store (which applies tag checks), not hand back the
      // pre-mutation buffer.
      await expect(readPromise).resolves.toBeUndefined();
      expect(backend.get).toHaveBeenCalledWith('key-1', ['products-m1']);

      await writing;
    });

    it('still waits for the in-flight write to settle before reading', async () => {
      // Next's contract: "If a `get` for the same cache key is called before the
      // pending entry is complete, the cache handler must wait for the `set`
      // operation to finish, before returning the entry."
      const order: string[] = [];
      let releaseWrite: () => void = () => {};
      const backend = makeBackend();
      backend.set.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            releaseWrite = () => {
              order.push('set-settled');
              resolve();
            };
          })
      );
      backend.get.mockImplementation(async () => {
        order.push('get-called');
        return makeEntry('from-store');
      });

      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        backendTimeoutMs: 200,
      });

      const writing = handler.set('key-1', Promise.resolve(makeEntry()));
      const reading = handler.get('key-1', []);

      // Give the read a chance to (incorrectly) race ahead.
      await new Promise((resolve) => setImmediate(resolve));
      releaseWrite();
      await reading;
      await writing;

      expect(order).toEqual(['set-settled', 'get-called']);
    });

    it('does not wait forever on a hung write', async () => {
      const backend = makeBackend();
      backend.set.mockImplementation(() => new Promise<void>(() => {}));
      backend.get.mockImplementation(async () => makeEntry('from-store'));

      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        backendTimeoutMs: 25,
      });

      void handler.set('key-1', Promise.resolve(makeEntry()));

      // A hung write must not wedge every subsequent read of that key, and the
      // read must not fetch a potentially pre-write value from the store.
      const entry = await handler.get('key-1', []);
      expect(entry).toBeUndefined();
      expect(backend.get).not.toHaveBeenCalled();
    });
  });
});
