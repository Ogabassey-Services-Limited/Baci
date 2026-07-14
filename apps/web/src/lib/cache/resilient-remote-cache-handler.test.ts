// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encoder,
  type FakeBackend,
  type FakeLogger,
  makeBackend,
  makeEntry,
  makeLogger,
} from './remote-cache-test-fixtures';
import { createResilientRemoteCacheHandler } from './resilient-remote-cache-handler.mjs';

/**
 * Core contract for the application-owned `cacheHandlers.remote` adapter
 * (plan §4.4 / PR 4 acceptance criteria).
 *
 * The framework default turns a rejected `set()` into an unhandled rejection and
 * `exit 128` — AFTER the HTTP 200 has already been sent (vercel/next.js#94751).
 * This adapter makes every backend failure mode a quiet, RESOLVED non-event,
 * while keeping the SHARED store (inventory §8: every remaining site has a live
 * revalidator, so demoting to a local cache would break tag invalidation).
 */
describe('createResilientRemoteCacheHandler', () => {
  let _backend: FakeBackend;
  let logger: FakeLogger;

  beforeEach(() => {
    _backend = makeBackend();
    logger = makeLogger();
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
});
