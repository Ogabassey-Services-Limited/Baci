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
