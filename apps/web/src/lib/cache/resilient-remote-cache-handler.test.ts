// @vitest-environment node
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { createResilientRemoteCacheHandler } from './resilient-remote-cache-handler.mjs';

/** Mirrors Next 16's `CacheEntry` (server/lib/cache-handlers/types.d.ts). */
type CacheEntryLike = {
  value: ReadableStream<Uint8Array>;
  tags: string[];
  stale: number;
  timestamp: number;
  expire: number;
  revalidate: number;
};

/**
 * Contract for the application-owned `cacheHandlers.remote` adapter
 * (plan §4.4 / PR 4 acceptance criteria).
 *
 * The framework default turns a rejected `set()` into an unhandled rejection
 * and `exit 128` — AFTER the HTTP 200 has already been sent
 * (vercel/next.js#94751). This adapter's job is to make every backend failure
 * mode a *quiet, resolved* non-event, while keeping the SHARED store (the
 * inventory §8 correction: every remaining site has a live revalidator, so
 * demoting to a local cache would silently break tag invalidation).
 */
describe('createResilientRemoteCacheHandler', () => {
  const encoder = new TextEncoder();

  type Backend = {
    get: Mock<
      (
        cacheKey: string,
        softTags: string[]
      ) => Promise<CacheEntryLike | undefined>
    >;
    set: Mock<
      (cacheKey: string, pendingEntry: Promise<CacheEntryLike>) => Promise<void>
    >;
    refreshTags: Mock<() => Promise<void>>;
    getExpiration: Mock<(tags: string[]) => Promise<number>>;
    updateTags: Mock<
      (tags: string[], durations?: { expire?: number }) => Promise<void>
    >;
  };

  function makeEntry(
    body = 'cached-payload',
    tags: string[] = ['products-m1']
  ) {
    return {
      value: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(body));
          controller.close();
        },
      }),
      tags,
      stale: 300,
      timestamp: 1_000,
      expire: 86_400,
      revalidate: 300,
    };
  }

  function makeBackend(overrides: Partial<Backend> = {}): Backend {
    return {
      get: vi.fn<Backend['get']>().mockResolvedValue(undefined),
      set: vi.fn<Backend['set']>().mockResolvedValue(undefined),
      refreshTags: vi.fn<Backend['refreshTags']>().mockResolvedValue(undefined),
      getExpiration: vi.fn<Backend['getExpiration']>().mockResolvedValue(0),
      updateTags: vi.fn<Backend['updateTags']>().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  let logger: {
    log: Mock<(message: string) => void>;
    warn: Mock<(message: string) => void>;
    error: Mock<(message: string) => void>;
  };

  beforeEach(() => {
    logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  /* ---------------------------------------------------------------- */
  /*  get() — failure becomes a MISS, never a throw                    */
  /* ---------------------------------------------------------------- */

  describe('get()', () => {
    it('passes a healthy hit through from the shared backend', async () => {
      const backend = makeBackend({
        get: vi.fn().mockResolvedValue(makeEntry('hit-body')),
      });
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      const entry = await handler.get('key-1', ['soft-tag']);

      expect(entry).toBeDefined();
      await expect(new Response(entry?.value).text()).resolves.toBe('hit-body');
      expect(backend.get).toHaveBeenCalledWith('key-1', ['soft-tag']);
    });

    it('resolves as a MISS (undefined) when the backend rejects with a 503', async () => {
      const backend = makeBackend({
        get: vi.fn().mockRejectedValue(new Error('503 Service Unavailable')),
      });
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      await expect(handler.get('key-1', [])).resolves.toBeUndefined();
    });

    it('resolves as a MISS when the backend times out', async () => {
      const backend = makeBackend({
        get: vi.fn().mockRejectedValue(new Error('ETIMEDOUT')),
      });
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      await expect(handler.get('key-1', [])).resolves.toBeUndefined();
    });

    it('counts the failure without ever putting the cache key in a label', async () => {
      const backend = makeBackend({
        get: vi.fn().mockRejectedValue(new Error('502 Bad Gateway')),
      });
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      await handler.get('merchant-9f1c/products/iphone-15-pro-max', []);

      expect(handler.getTelemetrySnapshot()).toMatchObject({
        'get.failure': 1,
      });
      for (const key of Object.keys(handler.getTelemetrySnapshot())) {
        expect(key).not.toContain('iphone-15-pro-max');
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  set() — THE process-killer. Must always RESOLVE.                 */
  /* ---------------------------------------------------------------- */

  describe('set()', () => {
    it('writes an in-budget entry through to the shared backend', async () => {
      const backend = makeBackend();
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      await handler.set('key-1', Promise.resolve(makeEntry('body')));

      expect(backend.set).toHaveBeenCalledTimes(1);
      const [key, pending] = backend.set.mock.calls[0] as [
        string,
        Promise<{ value: ReadableStream }>,
      ];
      expect(key).toBe('key-1');
      // The backend must receive a *fresh*, undrained stream.
      await expect(new Response((await pending).value).text()).resolves.toBe(
        'body'
      );
    });

    it('RESOLVES (never rejects) when the backend set() rejects with a 502', async () => {
      const backend = makeBackend({
        set: vi.fn().mockRejectedValue(new Error('502 Bad Gateway')),
      });
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      // This is the exact promise Next pushes onto `pendingRevalidateWrites`
      // and awaits AFTER the response is flushed. A rejection here is the
      // unhandled rejection that kills the process.
      await expect(
        handler.set('key-1', Promise.resolve(makeEntry()))
      ).resolves.toBeUndefined();
    });

    it('RESOLVES when the backend set() rejects with a 503', async () => {
      const backend = makeBackend({
        set: vi.fn().mockRejectedValue(new Error('503 Service Unavailable')),
      });
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      await expect(
        handler.set('key-1', Promise.resolve(makeEntry()))
      ).resolves.toBeUndefined();
    });

    it('RESOLVES when the backend set() times out', async () => {
      const backend = makeBackend({
        set: vi.fn().mockRejectedValue(new Error('ETIMEDOUT')),
      });
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      await expect(
        handler.set('key-1', Promise.resolve(makeEntry()))
      ).resolves.toBeUndefined();
    });

    it('RESOLVES when the pending entry itself rejects (failed render)', async () => {
      const backend = makeBackend();
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      await expect(
        handler.set('key-1', Promise.reject(new Error('render failed')))
      ).resolves.toBeUndefined();
      expect(backend.set).not.toHaveBeenCalled();
    });

    it('RESOLVES when the entry value stream errors mid-flight', async () => {
      const backend = makeBackend();
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      const broken = {
        value: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('partial'));
            controller.error(new Error('stream aborted'));
          },
        }),
        tags: [],
        stale: 300,
        timestamp: 1_000,
        expire: 86_400,
        revalidate: 300,
      };

      await expect(
        handler.set('key-1', Promise.resolve(broken))
      ).resolves.toBeUndefined();
      expect(backend.set).not.toHaveBeenCalled();
    });

    it('logs the write failure so it stays observable', async () => {
      const backend = makeBackend({
        set: vi.fn().mockRejectedValue(new Error('502 Bad Gateway')),
      });
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      await handler.set('key-1', Promise.resolve(makeEntry()));

      expect(logger.warn).toHaveBeenCalled();
      expect(handler.getTelemetrySnapshot()).toMatchObject({
        'set.failure': 1,
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Size limit                                                       */
  /* ---------------------------------------------------------------- */

  describe('size limit', () => {
    it('refuses to write an oversized item — skips quietly, does not throw', async () => {
      const backend = makeBackend();
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        maxItemBytes: 16,
      });

      await expect(
        handler.set('key-1', Promise.resolve(makeEntry('x'.repeat(64))))
      ).resolves.toBeUndefined();

      expect(backend.set).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
      expect(handler.getTelemetrySnapshot()).toMatchObject({
        'set.skip_oversized': 1,
      });
    });

    it('still writes an item exactly at the cap', async () => {
      const backend = makeBackend();
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        maxItemBytes: 8,
      });

      await handler.set('key-1', Promise.resolve(makeEntry('12345678')));

      expect(backend.set).toHaveBeenCalledTimes(1);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Circuit breaker                                                  */
  /* ---------------------------------------------------------------- */

  describe('circuit breaker', () => {
    it('short-circuits to miss-only after N consecutive backend failures', async () => {
      const backend = makeBackend({
        get: vi.fn().mockRejectedValue(new Error('503')),
      });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        failureThreshold: 3,
        cooldownMs: 30_000,
        now: () => 0,
      });

      await handler.get('k1', []);
      await handler.get('k2', []);
      await handler.get('k3', []);
      expect(backend.get).toHaveBeenCalledTimes(3);

      // Circuit is open: the sick backend is no longer touched.
      await expect(handler.get('k4', [])).resolves.toBeUndefined();
      expect(backend.get).toHaveBeenCalledTimes(3);
      expect(handler.getTelemetrySnapshot()).toMatchObject({
        'get.skip_circuit_open': 1,
      });
    });

    it('stops writing to a sick backend while the circuit is open', async () => {
      const backend = makeBackend({
        set: vi.fn().mockRejectedValue(new Error('503')),
      });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        failureThreshold: 2,
        cooldownMs: 30_000,
        now: () => 0,
      });

      await handler.set('k1', Promise.resolve(makeEntry()));
      await handler.set('k2', Promise.resolve(makeEntry()));
      expect(backend.set).toHaveBeenCalledTimes(2);

      await expect(
        handler.set('k3', Promise.resolve(makeEntry()))
      ).resolves.toBeUndefined();
      expect(backend.set).toHaveBeenCalledTimes(2);
    });

    it('probes again after the cooldown and recovers when the backend heals', async () => {
      let current = 0;
      const backend = makeBackend({
        get: vi.fn().mockRejectedValue(new Error('503')),
      });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        failureThreshold: 1,
        cooldownMs: 30_000,
        now: () => current,
      });

      await handler.get('k1', []);
      expect(backend.get).toHaveBeenCalledTimes(1);

      // Open — no traffic reaches the backend.
      await handler.get('k2', []);
      expect(backend.get).toHaveBeenCalledTimes(1);

      // Backend heals; cooldown elapses; the probe goes through and closes it.
      current = 30_000;
      backend.get.mockResolvedValue(makeEntry('healed'));

      const probed = await handler.get('k3', []);
      expect(probed).toBeDefined();
      await expect(new Response(probed?.value).text()).resolves.toBe('healed');

      const after = await handler.get('k4', []);
      expect(after).toBeDefined();
      expect(backend.get).toHaveBeenCalledTimes(3);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Invalidation — the §8 invariant                                  */
  /* ---------------------------------------------------------------- */

  describe('tag invalidation', () => {
    it('delegates updateTags to the shared backend (cross-instance bust must survive)', async () => {
      const backend = makeBackend();
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      await handler.updateTags(['products-m1'], { expire: 60 });

      expect(backend.updateTags).toHaveBeenCalledWith(['products-m1'], {
        expire: 60,
      });
    });

    it('attempts updateTags even while the circuit is open (invalidation is correctness, not throughput)', async () => {
      const backend = makeBackend({
        get: vi.fn().mockRejectedValue(new Error('503')),
      });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        failureThreshold: 1,
        now: () => 0,
      });

      await handler.get('k1', []); // trips the breaker

      await handler.updateTags(['products-m1']);

      expect(backend.updateTags).toHaveBeenCalledWith(['products-m1']);
    });

    it('resolves (never rejects) when updateTags fails, and logs it as an error', async () => {
      const backend = makeBackend({
        updateTags: vi.fn().mockRejectedValue(new Error('503')),
      });
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      await expect(
        handler.updateTags(['products-m1'])
      ).resolves.toBeUndefined();

      // A dropped invalidation is a freshness bug — it must be loud.
      expect(logger.error).toHaveBeenCalled();
      expect(handler.getTelemetrySnapshot()).toMatchObject({
        'update_tags.failure': 1,
      });
    });

    it('resolves as a no-op when refreshTags fails', async () => {
      const backend = makeBackend({
        refreshTags: vi.fn().mockRejectedValue(new Error('503')),
      });
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      await expect(handler.refreshTags()).resolves.toBeUndefined();
    });

    it('defers expiration to get() when getExpiration fails, so a stale entry cannot be served as fresh', async () => {
      const backend = makeBackend({
        getExpiration: vi.fn().mockRejectedValue(new Error('503')),
      });
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      // Per Next's contract, Infinity means "pass the soft tags into get()
      // instead". Returning 0 ("never revalidated") would let a busted entry be
      // served as fresh; Infinity degrades to a miss and a recompute.
      await expect(handler.getExpiration(['products-m1'])).resolves.toBe(
        Number.POSITIVE_INFINITY
      );
    });
  });

  /* ---------------------------------------------------------------- */
  /*  In-flight coordination (Next's documented set/get contract)       */
  /* ---------------------------------------------------------------- */

  describe('pending writes', () => {
    it('serves a concurrent get() for a key whose set() is still in flight', async () => {
      let releaseBackendSet: () => void = () => {};
      const backend = makeBackend({
        set: vi.fn().mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              releaseBackendSet = resolve;
            })
        ),
      });
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      const setPromise = handler.set(
        'key-1',
        Promise.resolve(makeEntry('in-flight'))
      );
      // Next: "If a get for the same cache key is called before the pending
      // entry is complete, the cache handler must wait for the set operation to
      // finish, before returning the entry, instead of returning undefined."
      const entry = await handler.get('key-1', []);

      expect(entry).toBeDefined();
      await expect(new Response(entry?.value).text()).resolves.toBe(
        'in-flight'
      );
      expect(backend.get).not.toHaveBeenCalled();

      releaseBackendSet();
      await setPromise;
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Kill switch                                                       */
  /* ---------------------------------------------------------------- */

  describe('disabled mode', () => {
    it('degrades to miss-only without touching the backend', async () => {
      const backend = makeBackend();
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        disabled: true,
      });

      await expect(handler.get('k1', [])).resolves.toBeUndefined();
      await expect(
        handler.set('k1', Promise.resolve(makeEntry()))
      ).resolves.toBeUndefined();

      expect(backend.get).not.toHaveBeenCalled();
      expect(backend.set).not.toHaveBeenCalled();
      // Invalidation still propagates — correctness is not part of the kill switch.
      await handler.updateTags(['products-m1']);
      expect(backend.updateTags).toHaveBeenCalled();
    });
  });
});
