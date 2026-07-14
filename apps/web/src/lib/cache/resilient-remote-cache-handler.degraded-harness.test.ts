// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type CacheHandlerLike,
  encodeEntry,
  encoder,
  flushEventLoop,
  PRODUCT,
  renderRouteThroughCache,
} from './remote-cache-harness-fixtures';
import { createResilientRemoteCacheHandler } from './resilient-remote-cache-handler.mjs';

describe('remote cache degraded-subsystem harness', () => {
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

    /* -------------------------------------------------------------- */
    /*  Dropped invalidations — the DURABLE failure                     */
    /* -------------------------------------------------------------- */

    it('a tag bust racing an in-flight set() is honoured, not bypassed (PRRT_kwDOQZgfis6Qmv0x)', async () => {
      // The store is invalidated mid-write, so it no longer holds the entry.
      //
      // START BARRIER: `handler.set()` yields while it buffers the entry, so
      // without this the tag bust could fire BEFORE the backend write is
      // actually in flight — and the test would pass without ever racing the
      // thing it claims to race.
      let releaseWrite!: () => void;
      let signalWriteStarted!: () => void;
      const writeStarted = new Promise<void>((resolve) => {
        signalWriteStarted = resolve;
      });

      const backend: CacheHandlerLike = {
        get: vi.fn().mockResolvedValue(undefined),
        set: vi.fn().mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              releaseWrite = resolve;
              signalWriteStarted();
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
      // ...wait until that write is genuinely blocked inside the backend...
      await writeStarted;
      expect(backend.set).toHaveBeenCalledTimes(1);

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
});
