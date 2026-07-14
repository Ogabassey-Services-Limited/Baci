// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type CacheHandlerLike,
  flushEventLoop,
  makeHostileBackend,
  PRODUCT,
  renderRouteThroughCache,
} from './remote-cache-harness-fixtures';
import { createResilientRemoteCacheHandler } from './resilient-remote-cache-handler.mjs';

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

      // Discrete sequential requests: each request's write settles before the
      // next arrives, as it does in a real request lifecycle.
      for (let i = 0; i < 20; i += 1) {
        await renderRouteThroughCache(
          handler,
          `products/product-${i}`,
          ['products-m1'],
          async () => PRODUCT,
          pendingRevalidateWrites
        );
        await Promise.all(pendingRevalidateWrites);
      }

      // Writes: capped by the breaker at the failure threshold. With a single
      // shared breaker, the interleaved READ successes reset the failure count
      // and all 20 writes hammered the dead backend.
      //
      // (A burst of genuinely CONCURRENT writes can exceed this slightly: the
      // gate is checked when the write starts, so writes already in flight when
      // the first failure lands still reach the backend. That slack is bounded
      // by in-flight concurrency, not by request count — which is the property
      // that matters.)
      expect((backend.set as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
        3
      );

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
});
