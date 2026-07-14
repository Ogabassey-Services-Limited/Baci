// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  CACHE_BREAKER_LEGS,
  createCacheBreakers,
} from './remote-cache-breakers.mjs';
import { createResilientRemoteCacheHandler } from './resilient-remote-cache-handler.mjs';

/**
 * THE BREAKER MODEL: one breaker PER LEG.
 *
 * We hit the same disease twice at two granularities — a healthy operation's
 * successes resetting a sick operation's failure count:
 *
 *   1. reads vs writes: `set()` 502s while `get()` serves → circuit never opened.
 *   2. `get` vs other read legs: Next calls `refreshTags()` BEFORE `get()` on
 *      EVERY request, so a successful refreshTags reset the shared read count
 *      each request and a get-ONLY outage never opened the circuit.
 *
 * Failure accounting must therefore be per-operation.
 */
describe('per-leg circuit breakers', () => {
  const encoder = new TextEncoder();

  function makeEntry(body = 'cached') {
    return {
      value: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(body));
          controller.close();
        },
      }),
      tags: ['products-m1'],
      stale: 300,
      timestamp: 1_000,
      expire: 86_400,
      revalidate: 300,
    };
  }

  it('gives every leg its own independent breaker', () => {
    const breakers = createCacheBreakers({ failureThreshold: 1, now: () => 0 });

    breakers('get').recordFailure();

    expect(breakers('get').getState()).toBe('open');
    for (const leg of CACHE_BREAKER_LEGS.filter((l) => l !== 'get')) {
      expect(breakers(leg).getState()).toBe('closed');
    }
  });

  /**
   * The round-3 bug, end to end: a get-only outage while refreshTags stays
   * healthy. Next calls refreshTags before get on every request.
   */
  it('opens the GET circuit during a get-only outage even though refreshTags keeps succeeding', async () => {
    const backend = {
      get: vi.fn().mockRejectedValue(new Error('502 Bad Gateway')),
      set: vi.fn().mockResolvedValue(undefined),
      refreshTags: vi.fn().mockResolvedValue(undefined), // healthy — resets nothing now
      getExpiration: vi.fn().mockResolvedValue(0),
      updateTags: vi.fn().mockResolvedValue(undefined),
    };
    const handler = createResilientRemoteCacheHandler({
      backend,
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      failureThreshold: 3,
      cooldownMs: 30_000,
      now: () => 0,
    });

    // Replay Next's real per-request order: refreshTags, then get.
    for (let i = 0; i < 3; i += 1) {
      await handler.refreshTags();
      await handler.get(`k${i}`, []);
    }
    expect(backend.get).toHaveBeenCalledTimes(3);

    // With a shared read breaker the successful refreshTags reset the count
    // every request and this stayed closed forever.
    await handler.refreshTags();
    await expect(handler.get('k4', [])).resolves.toBeUndefined();
    expect(backend.get).toHaveBeenCalledTimes(3);
    expect(handler.getTelemetrySnapshot()).toMatchObject({
      'get.skip_circuit_open': 1,
    });
  });

  it('keeps refreshTags flowing while the get circuit is open', async () => {
    const backend = {
      get: vi.fn().mockRejectedValue(new Error('502')),
      set: vi.fn().mockResolvedValue(undefined),
      refreshTags: vi.fn().mockResolvedValue(undefined),
      getExpiration: vi.fn().mockResolvedValue(0),
      updateTags: vi.fn().mockResolvedValue(undefined),
    };
    const handler = createResilientRemoteCacheHandler({
      backend,
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      failureThreshold: 1,
      now: () => 0,
    });

    await handler.get('k1', []); // trips the get breaker
    await handler.refreshTags();

    expect(backend.refreshTags).toHaveBeenCalledTimes(1);
  });

  /* ---------------------------------------------------------------- */
  /*  FAULT ATTRIBUTION — a breaker only counts faults of what it protects */
  /* ---------------------------------------------------------------- */

  describe('fault attribution', () => {
    function makeHandler(
      backend: Parameters<
        typeof createResilientRemoteCacheHandler
      >[0]['backend']
    ) {
      return createResilientRemoteCacheHandler({
        backend,
        logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        failureThreshold: 2,
        cooldownMs: 30_000,
        backendTimeoutMs: 25,
        now: () => 0,
      });
    }

    function healthyBackend() {
      return {
        get: vi.fn().mockResolvedValue(undefined),
        set: vi.fn().mockResolvedValue(undefined),
        refreshTags: vi.fn().mockResolvedValue(undefined),
        getExpiration: vi.fn().mockResolvedValue(0),
        updateTags: vi.fn().mockResolvedValue(undefined),
      };
    }

    /** A pendingEntry whose stream stalls — i.e. a SLOW REACT RENDER. */
    function stalledRenderEntry() {
      return Promise.resolve({
        value: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('partial render'));
            // ...and then nothing. The render never finishes.
          },
        }),
        tags: ['products-m1'],
        stale: 300,
        timestamp: 1_000,
        expire: 86_400,
        revalidate: 300,
      });
    }

    /** A pendingEntry whose stream errors — i.e. a CRASHED REACT RENDER. */
    function crashedRenderEntry() {
      return Promise.resolve({
        value: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('partial render'));
            controller.error(new Error('render threw'));
          },
        }),
        tags: ['products-m1'],
        stale: 300,
        timestamp: 1_000,
        expire: 86_400,
        revalidate: 300,
      });
    }

    it('a STALLED RSC render must NOT open the write circuit (the backend is healthy)', async () => {
      const backend = healthyBackend();
      const handler = makeHandler(backend);

      // Enough render stalls to trip the breaker, if they were (wrongly) counted.
      for (let i = 0; i < 5; i += 1) {
        await handler.set(`k${i}`, stalledRenderEntry());
      }

      // The backend never even saw these writes — it must not be blamed. A slow
      // render must never be able to disable caching platform-wide.
      expect(backend.set).not.toHaveBeenCalled();

      // Proof the circuit is still CLOSED: a healthy write still goes through.
      await handler.set('healthy', Promise.resolve(makeEntry('ok')));
      expect(backend.set).toHaveBeenCalledTimes(1);
    });

    it('a CRASHED RSC render must NOT open the write circuit either', async () => {
      const backend = healthyBackend();
      const handler = makeHandler(backend);

      for (let i = 0; i < 5; i += 1) {
        await handler.set(`k${i}`, crashedRenderEntry());
      }
      expect(backend.set).not.toHaveBeenCalled();

      await handler.set('healthy', Promise.resolve(makeEntry('ok')));
      expect(backend.set).toHaveBeenCalledTimes(1);
    });

    it('but a failing BACKEND write DOES open the write circuit', async () => {
      const backend = healthyBackend();
      backend.set.mockRejectedValue(new Error('502 Bad Gateway'));
      const handler = makeHandler(backend);

      await handler.set('k1', Promise.resolve(makeEntry('ok')));
      await handler.set('k2', Promise.resolve(makeEntry('ok')));
      expect(backend.set).toHaveBeenCalledTimes(2);

      // Circuit open — the sick backend is spared.
      await handler.set('k3', Promise.resolve(makeEntry('ok')));
      expect(backend.set).toHaveBeenCalledTimes(2);
    });

    it('and a HANGING backend write DOES open the write circuit', async () => {
      const backend = healthyBackend();
      backend.set.mockImplementation(() => new Promise<void>(() => {}));
      const handler = makeHandler(backend);

      await handler.set('k1', Promise.resolve(makeEntry('ok')));
      await handler.set('k2', Promise.resolve(makeEntry('ok')));
      expect(backend.set).toHaveBeenCalledTimes(2);

      await handler.set('k3', Promise.resolve(makeEntry('ok')));
      expect(backend.set).toHaveBeenCalledTimes(2);
    });

    it('a broken entry stream FROM THE BACKEND does open the READ circuit', async () => {
      // The mirror image: on the read path the stream is the backend's, so an
      // identical failure IS its fault.
      const backend = healthyBackend();
      backend.get.mockImplementation(async () => ({
        value: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('partial'));
            controller.error(new Error('connection reset'));
          },
        }),
        tags: ['products-m1'],
        stale: 300,
        timestamp: 1_000,
        expire: 86_400,
        revalidate: 300,
      }));
      const handler = makeHandler(backend);

      await handler.get('k1', []);
      await handler.get('k2', []);
      expect(backend.get).toHaveBeenCalledTimes(2);

      await expect(handler.get('k3', [])).resolves.toBeUndefined();
      expect(backend.get).toHaveBeenCalledTimes(2);
    });
  });

  /**
   * A half-open probe that is admitted but aborts LOCALLY (the payload is
   * rejected before we ever call the backend) must hand the probe slot back —
   * otherwise `probeInFlight` stays set and the breaker can never close again.
   */
  it('releases the probe when an oversized write aborts before reaching the backend', async () => {
    let current = 0;
    const backend = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockRejectedValue(new Error('502')),
      refreshTags: vi.fn().mockResolvedValue(undefined),
      getExpiration: vi.fn().mockResolvedValue(0),
      updateTags: vi.fn().mockResolvedValue(undefined),
    };
    const handler = createResilientRemoteCacheHandler({
      backend,
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      failureThreshold: 1,
      cooldownMs: 30_000,
      maxItemBytes: 8,
      now: () => current,
    });

    // Trip the write circuit.
    await handler.set('k1', Promise.resolve(makeEntry('body')));
    expect(backend.set).toHaveBeenCalledTimes(1);

    // Cooldown elapses → the next write is admitted as the half-open probe, but
    // it is oversized and never reaches the backend.
    current = 30_000;
    await handler.set('k2', Promise.resolve(makeEntry('x'.repeat(64))));
    expect(backend.set).toHaveBeenCalledTimes(1);

    // The probe slot must be back: a healthy write can still get through.
    backend.set.mockResolvedValue(undefined);
    await handler.set('k3', Promise.resolve(makeEntry('ok')));

    expect(backend.set).toHaveBeenCalledTimes(2);
  });
});
