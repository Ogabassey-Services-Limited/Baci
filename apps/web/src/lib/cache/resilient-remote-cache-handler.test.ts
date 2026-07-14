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
        get: vi.fn().mockImplementation(async () => makeEntry('hit-body')),
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

    /**
     * Codex `PRRT_kwDOQZgfis6QmUok` — the exact outage this handler exists for.
     *
     * A remote-cache WRITE outage (`set()` 502s while `get()` still serves) is
     * the production scenario from plan §4.4. With one breaker shared between
     * reads and writes, every successful read called `recordSuccess()` and reset
     * the consecutive-failure count, so the circuit NEVER opened and we kept
     * hammering a backend that could not accept writes.
     */
    it('opens the WRITE circuit during a write-only outage even while reads keep succeeding', async () => {
      const backend = makeBackend({
        get: vi
          .fn<Backend['get']>()
          .mockImplementation(async () => makeEntry('still-served')),
        set: vi
          .fn<Backend['set']>()
          .mockRejectedValue(new Error('502 Bad Gateway')),
      });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        failureThreshold: 3,
        cooldownMs: 30_000,
        now: () => 0,
      });

      // Interleave reads and writes, exactly as a live route does.
      for (let i = 0; i < 3; i += 1) {
        await handler.get(`k${i}`, []);
        await handler.set(`k${i}`, Promise.resolve(makeEntry()));
      }
      expect(backend.set).toHaveBeenCalledTimes(3);

      // The write circuit must now be open despite the interleaved read successes.
      await handler.set('k4', Promise.resolve(makeEntry()));
      expect(backend.set).toHaveBeenCalledTimes(3);
      expect(handler.getTelemetrySnapshot()).toMatchObject({
        'set.skip_circuit_open': 1,
      });
    });

    it('keeps READS flowing while the write circuit is open', async () => {
      const backend = makeBackend({
        get: vi
          .fn<Backend['get']>()
          .mockImplementation(async () => makeEntry('read-ok')),
        set: vi
          .fn<Backend['set']>()
          .mockRejectedValue(new Error('502 Bad Gateway')),
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

      // Write path is open; the read path must be untouched — a write outage
      // must not throw away a perfectly healthy cache read.
      const entry = await handler.get('k3', []);
      expect(entry).toBeDefined();
      await expect(new Response(entry?.value).text()).resolves.toBe('read-ok');
    });

    it('does not open the write circuit because of read failures', async () => {
      const backend = makeBackend({
        get: vi.fn<Backend['get']>().mockRejectedValue(new Error('503')),
      });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        failureThreshold: 2,
        cooldownMs: 30_000,
        now: () => 0,
      });

      await handler.get('k1', []);
      await handler.get('k2', []);

      // Reads are circuit-broken, but writes are a separate concern.
      await handler.set('k3', Promise.resolve(makeEntry()));
      expect(backend.set).toHaveBeenCalledTimes(1);
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
      backend.get.mockImplementation(async () => makeEntry('healed'));

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

    it('resolves (never rejects) when refreshTags fails', async () => {
      const backend = makeBackend({
        refreshTags: vi.fn().mockRejectedValue(new Error('503')),
      });
      const handler = createResilientRemoteCacheHandler({ backend, logger });

      await expect(handler.refreshTags()).resolves.toBeUndefined();
    });

    /**
     * Codex `PRRT_kwDOQZgfis6Qmv0o` (round 2). Next awaits refreshTags BEFORE
     * cacheHandler.get() (use-cache-wrapper.js ~1277), so a stale tag manifest
     * would be used by the very next read — which could then hand back a
     * PRE-INVALIDATION entry. A failure must degrade reads to the origin.
     */
    it('degrades reads to the origin when refreshTags fails', async () => {
      const backend = makeBackend({
        get: vi
          .fn()
          .mockImplementation(async () => makeEntry('pre-invalidation')),
        refreshTags: vi.fn().mockRejectedValue(new Error('503')),
      });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        now: () => 0,
      });

      await handler.refreshTags();

      await expect(handler.get('key-1', [])).resolves.toBeUndefined();
      expect(backend.get).not.toHaveBeenCalled();
      expect(handler.getTelemetrySnapshot()).toMatchObject({
        'get.skip_untrusted': 1,
      });
    });

    /**
     * Codex `PRRT_kwDOQZgfis6Qmv0r` (round 2) supersedes the earlier `Infinity`
     * answer. `getExpiration` is awaited AFTER `get()`, so Infinity ("implicit
     * tags are not expired") would have applied to the entry Next had ALREADY
     * taken from us. A FINITE `now` makes Next discard it. Full reasoning and
     * the Next source excerpt live in `remote-cache-freshness.test.ts`.
     */
    it('forces a MISS on subsequent reads when the expiration lookup failed', async () => {
      const backend = makeBackend({
        get: vi
          .fn()
          .mockImplementation(async () => makeEntry('possibly-stale')),
        getExpiration: vi.fn().mockRejectedValue(new Error('503')),
      });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        now: () => 0,
      });

      await handler.getExpiration(['products-m1']);

      await expect(handler.get('key-1', [])).resolves.toBeUndefined();
      // It must not even ask the store — the answer could not be validated.
      expect(backend.get).not.toHaveBeenCalled();
      expect(handler.getTelemetrySnapshot()).toMatchObject({
        'get.skip_untrusted': 1,
      });
    });

    it('resumes reading once a getExpiration call succeeds again', async () => {
      const backend = makeBackend({
        get: vi.fn().mockImplementation(async () => makeEntry('fresh')),
        getExpiration: vi
          .fn()
          .mockRejectedValueOnce(new Error('503'))
          .mockResolvedValue(0),
      });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        now: () => 0,
      });

      await handler.getExpiration(['products-m1']);
      await expect(handler.get('key-1', [])).resolves.toBeUndefined();

      // The tags service recovers; trust is restored and reads resume.
      await handler.getExpiration(['products-m1']);
      const entry = await handler.get('key-1', []);

      expect(entry).toBeDefined();
      await expect(new Response(entry?.value).text()).resolves.toBe('fresh');
    });

    it('re-trusts expiration after the distrust window lapses', async () => {
      let current = 0;
      const backend = makeBackend({
        get: vi.fn().mockImplementation(async () => makeEntry('fresh')),
        getExpiration: vi.fn().mockRejectedValue(new Error('503')),
      });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        cooldownMs: 30_000,
        now: () => current,
      });

      await handler.getExpiration(['products-m1']);
      await expect(handler.get('key-1', [])).resolves.toBeUndefined();

      // Bound the blast radius: a permanent latch would disable the cache
      // forever if getExpiration were never called again.
      current = 30_000;
      await expect(handler.get('key-1', [])).resolves.toBeDefined();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  In-flight coordination (Next's documented set/get contract)       */
  /* ---------------------------------------------------------------- */

  describe('pending writes', () => {
    /**
     * Codex `PRRT_kwDOQZgfis6Qmv0x` (round 2) REVERSED the earlier behaviour
     * here. We used to serve the in-flight write's buffer directly — which
     * bypassed the tag/expiration check entirely, so a tag bust racing the write
     * would be ignored and the pre-mutation value served. We now satisfy the
     * *wait* half of Next's contract and then re-read the shared store, which is
     * the only thing that can honour an invalidation. See
     * `remote-cache-freshness.test.ts` for the full scenario.
     */
    it('waits for the in-flight write, then reads the STORE rather than the buffer', async () => {
      let releaseBackendSet: () => void = () => {};
      const backend = makeBackend({
        set: vi.fn().mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              releaseBackendSet = resolve;
            })
        ),
        get: vi.fn().mockImplementation(async () => makeEntry('from-store')),
      });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        backendTimeoutMs: 200,
      });

      const setPromise = handler.set(
        'key-1',
        Promise.resolve(makeEntry('in-flight'))
      );
      const reading = handler.get('key-1', []);
      releaseBackendSet();
      const entry = await reading;

      // The value comes from the store (tag-checked), not the unchecked buffer.
      expect(backend.get).toHaveBeenCalledWith('key-1', []);
      await expect(new Response(entry?.value).text()).resolves.toBe(
        'from-store'
      );

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
