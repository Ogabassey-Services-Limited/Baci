// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type FakeBackend,
  type FakeLogger,
  makeBackend,
  makeEntry,
  makeLogger,
} from './remote-cache-test-fixtures';
import { createResilientRemoteCacheHandler } from './resilient-remote-cache-handler.mjs';

/**
 * Circuit-breaker behaviour. Failure accounting is PER LEG — see
 * `remote-cache-breakers.test.ts` for why a shared breaker could not detect a
 * partial outage.
 */
describe('createResilientRemoteCacheHandler — circuit breaker', () => {
  let _backend: FakeBackend;
  let logger: FakeLogger;

  beforeEach(() => {
    _backend = makeBackend();
    logger = makeLogger();
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
          .fn<FakeBackend['get']>()
          .mockImplementation(async () => makeEntry('still-served')),
        set: vi
          .fn<FakeBackend['set']>()
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
          .fn<FakeBackend['get']>()
          .mockImplementation(async () => makeEntry('read-ok')),
        set: vi
          .fn<FakeBackend['set']>()
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
        get: vi.fn<FakeBackend['get']>().mockRejectedValue(new Error('503')),
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
});
