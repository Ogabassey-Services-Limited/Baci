// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createResilientRemoteCacheHandler } from './resilient-remote-cache-handler.mjs';

/**
 * PR 4 failure harness (plan §4.4, acceptance criteria 1–2).
 *
 * This replays the framework's real `'use cache'` request sequence against a
 * cache backend that is returning 502/503/timeout, and asserts the three
 * invariants the plan makes non-negotiable:
 *
 *   (a) the route still returns correct, complete data;
 *   (b) no unhandled rejection and no process exit;
 *   (c) a cache-backend failure NEVER converts a found route into an
 *       empty/not-found one.
 *
 * The sequence below mirrors `next/dist/server/use-cache/use-cache-wrapper.js`:
 * the `set()` promise is pushed onto `workStore.pendingRevalidateWrites` and is
 * only awaited AFTER the response has been produced. When that promise rejects
 * and nothing has attached a handler, Node raises `unhandledRejection` and the
 * function exits 128 — with the HTTP 200 already on the wire.
 */

type CacheEntry = {
  value: ReadableStream<Uint8Array>;
  tags: string[];
  stale: number;
  timestamp: number;
  expire: number;
  revalidate: number;
};

type CacheHandlerLike = {
  get: (key: string, softTags: string[]) => Promise<CacheEntry | undefined>;
  set: (key: string, pending: Promise<CacheEntry>) => Promise<void>;
  refreshTags: () => Promise<void>;
  getExpiration: (tags: string[]) => Promise<number>;
  updateTags: (
    tags: string[],
    durations?: { expire?: number }
  ) => Promise<void>;
};

/** The product a found route must keep returning even with a dead cache. */
const PRODUCT = {
  slug: 'iphone-15-pro-max',
  name: 'iPhone 15 Pro Max',
  price: 1_850_000,
  inStock: true,
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encodeEntry(payload: unknown, tags: string[]): CacheEntry {
  const body = encoder.encode(JSON.stringify(payload));
  return {
    value: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(body);
        controller.close();
      },
    }),
    tags,
    stale: 300,
    timestamp: Date.now(),
    expire: 86_400,
    revalidate: 300,
  };
}

async function decodeEntry(entry: CacheEntry): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  const reader = entry.value.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(decoder.decode(merged));
}

/**
 * A faithful stand-in for the `'use cache: remote'` wrapper: consult the
 * handler, render on a miss, and hand the write to the handler WITHOUT awaiting
 * it inside the request (exactly what Next does).
 */
async function renderRouteThroughCache(
  handler: CacheHandlerLike,
  cacheKey: string,
  tags: string[],
  loader: () => Promise<typeof PRODUCT | null>,
  pendingRevalidateWrites: Promise<void>[]
): Promise<{ status: number; body: typeof PRODUCT | null }> {
  // Order and discard logic mirror `use-cache-wrapper.js` (~1277-1320) exactly:
  // refreshTags is awaited BEFORE get(); getExpiration is awaited AFTER it and
  // only when an entry exists; and the entry is then discarded when
  // `entry.timestamp <= implicitTagsExpiration` (shouldDiscardCacheEntry:1532).
  await handler.refreshTags();

  let hit = await handler.get(cacheKey, tags);

  if (hit) {
    let implicitTagsExpiration = 0;
    const expiration = await handler.getExpiration(tags);
    if (expiration < Number.POSITIVE_INFINITY) {
      implicitTagsExpiration = expiration;
    }
    if (hit.timestamp <= implicitTagsExpiration) {
      hit = undefined;
    }
  }

  if (hit) {
    return { status: 200, body: (await decodeEntry(hit)) as typeof PRODUCT };
  }

  const data = await loader();
  // A genuine "not found" is the ONLY thing allowed to 404.
  if (data === null) {
    return { status: 404, body: null };
  }

  const pendingEntry = Promise.resolve(encodeEntry(data, tags));
  // Fire-and-forget, exactly like `workStore.pendingRevalidateWrites.push(...)`.
  pendingRevalidateWrites.push(handler.set(cacheKey, pendingEntry));

  return { status: 200, body: data };
}

/** Let Node's microtask + macrotask queues drain so unhandledRejection can fire. */
async function flushEventLoop() {
  for (let i = 0; i < 3; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function makeHostileBackend(error: Error): CacheHandlerLike {
  return {
    get: vi.fn().mockRejectedValue(error),
    set: vi.fn().mockRejectedValue(error),
    refreshTags: vi.fn().mockRejectedValue(error),
    getExpiration: vi.fn().mockRejectedValue(error),
    updateTags: vi.fn().mockRejectedValue(error),
  };
}

describe('remote cache failure harness', () => {
  let unhandled: unknown[];
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let onUnhandled: (reason: unknown) => void;

  beforeEach(() => {
    unhandled = [];
    onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    // `exit 128` is the observed production symptom — assert nothing calls it.
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit was called');
    }) as never);
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
    exitSpy.mockRestore();
  });

  const backendFailures: [string, Error][] = [
    ['502 Bad Gateway', new Error('502 Bad Gateway')],
    ['503 Service Unavailable', new Error('503 Service Unavailable')],
    ['timeout', Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' })],
  ];

  describe.each(
    backendFailures
  )('when the cache backend fails with %s', (_label, error) => {
    it('still returns correct, complete data for a found route', async () => {
      const handler = createResilientRemoteCacheHandler({
        backend: makeHostileBackend(error),
        logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      });
      const pendingRevalidateWrites: Promise<void>[] = [];

      const response = await renderRouteThroughCache(
        handler,
        `products/${PRODUCT.slug}`,
        ['products-m1'],
        async () => PRODUCT,
        pendingRevalidateWrites
      );

      // (a) + (c): the route is found, complete, and NOT downgraded to 404/empty.
      expect(response.status).toBe(200);
      expect(response.body).toEqual(PRODUCT);
    });

    it('raises no unhandled rejection and never exits, even after the response is sent', async () => {
      const handler = createResilientRemoteCacheHandler({
        backend: makeHostileBackend(error),
        logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      });
      const pendingRevalidateWrites: Promise<void>[] = [];

      const response = await renderRouteThroughCache(
        handler,
        `products/${PRODUCT.slug}`,
        ['products-m1'],
        async () => PRODUCT,
        pendingRevalidateWrites
      );
      expect(response.status).toBe(200);

      // The response is now "on the wire". This is the window in which the
      // framework's rejected set() kills the process.
      await expect(Promise.all(pendingRevalidateWrites)).resolves.toBeDefined();
      await flushEventLoop();

      // (b)
      expect(unhandled).toEqual([]);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('never converts a found route into an empty or not-found one', async () => {
      const handler = createResilientRemoteCacheHandler({
        backend: makeHostileBackend(error),
        logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      });
      const loader = vi.fn().mockResolvedValue(PRODUCT);
      const pendingRevalidateWrites: Promise<void>[] = [];

      // Ten DISCRETE sequential requests — enough to trip the circuit breaker
      // and keep going in miss-only mode. Each request's write is allowed to
      // settle before the next one arrives (as it would between real requests),
      // so none of them is served from the in-flight pending-write map.
      const responses = [];
      for (let i = 0; i < 10; i += 1) {
        responses.push(
          await renderRouteThroughCache(
            handler,
            `products/${PRODUCT.slug}`,
            ['products-m1'],
            loader,
            pendingRevalidateWrites
          )
        );
        await Promise.all(pendingRevalidateWrites);
        await flushEventLoop();
      }

      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body).toEqual(PRODUCT);
      }
      // Every request fell through to the origin — a dead cache degrades to
      // "always recompute", never to "not found".
      expect(loader).toHaveBeenCalledTimes(10);
      expect(unhandled).toEqual([]);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('stops hammering the sick backend once the circuit opens', async () => {
      const backend = makeHostileBackend(error);
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        failureThreshold: 3,
        cooldownMs: 30_000,
        now: () => 0,
      });
      const pendingRevalidateWrites: Promise<void>[] = [];

      for (let i = 0; i < 25; i += 1) {
        await renderRouteThroughCache(
          handler,
          `products/product-${i}`,
          ['products-m1'],
          async () => PRODUCT,
          pendingRevalidateWrites
        );
      }
      await Promise.all(pendingRevalidateWrites);

      // Without a breaker this would be 25 gets + 25 sets against a dead backend.
      expect(
        (backend.get as ReturnType<typeof vi.fn>).mock.calls.length
      ).toBeLessThanOrEqual(3);
      expect(unhandled).toEqual([]);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Write-only outage — the ACTUAL production shape (§4.4)           */
  /* ---------------------------------------------------------------- */

  describe('write-only outage (set() 502s while get() still serves)', () => {
    function makeWriteOnlyOutageBackend(): CacheHandlerLike {
      return {
        get: vi.fn().mockResolvedValue(undefined), // healthy: serves misses
        set: vi.fn().mockRejectedValue(new Error('502 Bad Gateway')),
        refreshTags: vi.fn().mockResolvedValue(undefined),
        getExpiration: vi.fn().mockResolvedValue(0),
        updateTags: vi.fn().mockResolvedValue(undefined),
      };
    }

    it('serves every request correctly and never exits, across a sustained outage', async () => {
      const backend = makeWriteOnlyOutageBackend();
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        failureThreshold: 3,
        cooldownMs: 30_000,
        now: () => 0,
      });
      const pendingRevalidateWrites: Promise<void>[] = [];

      for (let i = 0; i < 20; i += 1) {
        const response = await renderRouteThroughCache(
          handler,
          `products/product-${i}`,
          ['products-m1'],
          async () => PRODUCT,
          pendingRevalidateWrites
        );
        expect(response.status).toBe(200);
        expect(response.body).toEqual(PRODUCT);
      }

      await expect(Promise.all(pendingRevalidateWrites)).resolves.toBeDefined();
      await flushEventLoop();

      expect(unhandled).toEqual([]);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('opens the WRITE circuit while READS keep flowing to the backend', async () => {
      const backend = makeWriteOnlyOutageBackend();
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        failureThreshold: 3,
        cooldownMs: 30_000,
        now: () => 0,
      });
      const pendingRevalidateWrites: Promise<void>[] = [];

      for (let i = 0; i < 20; i += 1) {
        await renderRouteThroughCache(
          handler,
          `products/product-${i}`,
          ['products-m1'],
          async () => PRODUCT,
          pendingRevalidateWrites
        );
      }
      await Promise.all(pendingRevalidateWrites);

      // Writes: capped by the breaker. With a single shared breaker, the
      // interleaved read successes reset the failure count and all 20 writes
      // hammered the dead backend.
      expect(
        (backend.set as ReturnType<typeof vi.fn>).mock.calls.length
      ).toBeLessThanOrEqual(3);

      // Reads: entirely unaffected — a write outage must not throw away a
      // healthy cache read path.
      expect((backend.get as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
        20
      );
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Codex round 2 — degraded subsystem, end to end                    */
  /* ---------------------------------------------------------------- */

  describe('a degraded cache subsystem never serves stale data (round 2)', () => {
    const STALE = {
      ...PRODUCT,
      price: 1_000,
      name: 'STALE — pre-invalidation',
    };

    /** Healthy store that WOULD hand back a pre-invalidation entry. */
    function backendServingStale(): CacheHandlerLike {
      return {
        get: vi
          .fn()
          .mockImplementation(async () => encodeEntry(STALE, ['products-m1'])),
        set: vi.fn().mockResolvedValue(undefined),
        refreshTags: vi.fn().mockResolvedValue(undefined),
        getExpiration: vi.fn().mockResolvedValue(0),
        updateTags: vi.fn().mockResolvedValue(undefined),
      };
    }

    function handlerFor(backend: CacheHandlerLike) {
      return createResilientRemoteCacheHandler({
        backend,
        logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        backendTimeoutMs: 25,
        failureThreshold: 3,
        cooldownMs: 30_000,
      });
    }

    const degradations: [string, (b: CacheHandlerLike) => void][] = [
      [
        'refreshTags() fails (PRRT_kwDOQZgfis6Qmv0o)',
        (b) => {
          (b.refreshTags as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('503')
          );
        },
      ],
      [
        'getExpiration() fails mid-read (PRRT_kwDOQZgfis6Qmv0r)',
        (b) => {
          (b.getExpiration as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('503')
          );
        },
      ],
      [
        'the entry stream is truncated (PRRT_kwDOQZgfis6Qmv0s)',
        (b) => {
          (b.get as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
            value: new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(encoder.encode('{"partial":'));
                controller.error(new Error('connection reset'));
              },
            }),
            tags: ['products-m1'],
            stale: 300,
            timestamp: Date.now(),
            expire: 86_400,
            revalidate: 300,
          }));
        },
      ],
    ];
    // NOTE: a hung `set()` is deliberately NOT in this table. It degrades the
    // WRITE path, and gives no reason for a healthy READ to miss — the store
    // legitimately holds that entry and nothing invalidated it, so serving it is
    // correct. Its invariants (resolves, opens the circuit, never exits) are
    // asserted in the dedicated hung-write test below.

    describe.each(degradations)('when %s', (_label, degrade) => {
      it('serves the ORIGIN — never the stale/partial cached value', async () => {
        const backend = backendServingStale();
        degrade(backend);
        const handler = handlerFor(backend);
        const pendingRevalidateWrites: Promise<void>[] = [];

        const response = await renderRouteThroughCache(
          handler,
          `products/${PRODUCT.slug}`,
          ['products-m1'],
          async () => PRODUCT,
          pendingRevalidateWrites
        );

        expect(response.status).toBe(200);
        // The fresh origin value, NOT the pre-invalidation one.
        expect(response.body).toEqual(PRODUCT);
        expect(response.body).not.toEqual(STALE);

        await expect(
          Promise.all(pendingRevalidateWrites)
        ).resolves.toBeDefined();
        await flushEventLoop();
        expect(unhandled).toEqual([]);
        expect(exitSpy).not.toHaveBeenCalled();
      });
    });

    it('a tag bust racing an in-flight set() is honoured, not bypassed (PRRT_kwDOQZgfis6Qmv0x)', async () => {
      // The store is invalidated mid-write, so it no longer holds the entry.
      let releaseWrite: () => void = () => {};
      const backend: CacheHandlerLike = {
        get: vi.fn().mockResolvedValue(undefined),
        set: vi.fn().mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              releaseWrite = resolve;
            })
        ),
        refreshTags: vi.fn().mockResolvedValue(undefined),
        getExpiration: vi.fn().mockResolvedValue(0),
        updateTags: vi.fn().mockResolvedValue(undefined),
      };
      const handler = handlerFor(backend);
      const pendingRevalidateWrites: Promise<void>[] = [];

      // Request A writes the pre-mutation value...
      pendingRevalidateWrites.push(
        handler.set(
          `products/${PRODUCT.slug}`,
          Promise.resolve(encodeEntry(STALE, ['products-m1']))
        )
      );
      // ...an admin mutation busts the tag...
      await handler.updateTags(['products-m1']);
      // ...and request B reads the same key while that write is still settling.
      const reading = renderRouteThroughCache(
        handler,
        `products/${PRODUCT.slug}`,
        ['products-m1'],
        async () => PRODUCT,
        pendingRevalidateWrites
      );
      releaseWrite();
      const response = await reading;

      // The invalidation wins: we consult the (now-empty) store and recompute.
      expect(response.body).toEqual(PRODUCT);
      expect(backend.get).toHaveBeenCalled();
      expect(backend.updateTags).toHaveBeenCalledWith(['products-m1']);

      await Promise.all(pendingRevalidateWrites);
      await flushEventLoop();
      expect(unhandled).toEqual([]);
    });

    it('opens the write circuit when set() HANGS, and still never exits', async () => {
      const backend = backendServingStale();
      (backend.set as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise<void>(() => {})
      );
      // Keep reads missing so every request attempts a write.
      (backend.get as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const handler = handlerFor(backend);
      const pendingRevalidateWrites: Promise<void>[] = [];

      for (let i = 0; i < 10; i += 1) {
        const response = await renderRouteThroughCache(
          handler,
          `products/product-${i}`,
          ['products-m1'],
          async () => PRODUCT,
          pendingRevalidateWrites
        );
        expect(response.body).toEqual(PRODUCT);
        await Promise.all(pendingRevalidateWrites);
      }

      // A hang must open the circuit exactly like a rejection does.
      expect(
        (backend.set as ReturnType<typeof vi.fn>).mock.calls.length
      ).toBeLessThanOrEqual(3);
      await flushEventLoop();
      expect(unhandled).toEqual([]);
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  The bug being fixed — proof the harness has teeth                */
  /* ---------------------------------------------------------------- */

  it('DOCUMENTS the framework-default failure: an unwrapped backend rejects the set() that Next awaits after the 200', async () => {
    const rawBackend = makeHostileBackend(new Error('503 Service Unavailable'));

    // This is what rides on the *default* handler today. The promise Next
    // pushes onto pendingRevalidateWrites rejects -> unhandled -> exit 128.
    const pending = rawBackend.set(
      `products/${PRODUCT.slug}`,
      Promise.resolve(encodeEntry(PRODUCT, ['products-m1']))
    );

    await expect(pending).rejects.toThrow('503 Service Unavailable');

    // The adapter turns exactly that into a resolved no-op.
    const handler = createResilientRemoteCacheHandler({
      backend: makeHostileBackend(new Error('503 Service Unavailable')),
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    await expect(
      handler.set(
        `products/${PRODUCT.slug}`,
        Promise.resolve(encodeEntry(PRODUCT, ['products-m1']))
      )
    ).resolves.toBeUndefined();
  });

  /* ---------------------------------------------------------------- */
  /*  Real 404s must survive the adapter                               */
  /* ---------------------------------------------------------------- */

  it('preserves a genuine 404 (absence is only ever decided by the origin)', async () => {
    const handler = createResilientRemoteCacheHandler({
      backend: makeHostileBackend(new Error('503 Service Unavailable')),
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    const pendingRevalidateWrites: Promise<void>[] = [];

    const response = await renderRouteThroughCache(
      handler,
      'products/does-not-exist',
      ['products-m1'],
      async () => null,
      pendingRevalidateWrites
    );

    expect(response.status).toBe(404);
    // ...and a transient cache failure never *created* that 404: the origin did.
    expect(unhandled).toEqual([]);
  });

  it('keeps serving correct data when the backend recovers mid-flight', async () => {
    const backend = makeHostileBackend(new Error('503 Service Unavailable'));
    let current = 0;
    const handler = createResilientRemoteCacheHandler({
      backend,
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      failureThreshold: 2,
      cooldownMs: 30_000,
      now: () => current,
    });
    const pendingRevalidateWrites: Promise<void>[] = [];

    await renderRouteThroughCache(
      handler,
      'k',
      ['t'],
      async () => PRODUCT,
      pendingRevalidateWrites
    );
    await renderRouteThroughCache(
      handler,
      'k',
      ['t'],
      async () => PRODUCT,
      pendingRevalidateWrites
    );

    // Backend heals.
    (backend.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      encodeEntry(PRODUCT, ['t'])
    );
    (backend.refreshTags as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    (backend.getExpiration as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    current = 30_000;

    const response = await renderRouteThroughCache(
      handler,
      'k',
      ['t'],
      async () => PRODUCT,
      pendingRevalidateWrites
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual(PRODUCT);
    await Promise.all(pendingRevalidateWrites);
    await flushEventLoop();
    expect(unhandled).toEqual([]);
  });
});
