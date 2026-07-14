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
 * Tag invalidation, in-flight-write coordination, and the kill switch.
 */
describe('createResilientRemoteCacheHandler — tags, pending writes, kill switch', () => {
  let _backend: FakeBackend;
  let logger: FakeLogger;

  beforeEach(() => {
    _backend = makeBackend();
    logger = makeLogger();
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
      // START BARRIER. `handler.set()` yields while it buffers the entry, so the
      // backend's `set` resolver does not exist yet when the test resumes.
      // Calling a no-op `releaseBackendSet` would leave the write blocked, the
      // read would fall through the awaitPending TIMEOUT path, and the test would
      // pass while asserting nothing about the successful-write path it names.
      let releaseBackendSet!: () => void;
      let signalSetStarted!: () => void;
      const setStarted = new Promise<void>((resolve) => {
        signalSetStarted = resolve;
      });

      const backend = makeBackend({
        set: vi.fn().mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              releaseBackendSet = resolve;
              signalSetStarted();
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
      // The backend write is now genuinely in flight and blocked.
      await setStarted;
      expect(backend.set).toHaveBeenCalledTimes(1);

      const reading = handler.get('key-1', []);
      releaseBackendSet();
      const entry = await reading;
      await setPromise;

      // The value comes from the store (tag-checked), not the unchecked buffer.
      expect(backend.get).toHaveBeenCalledWith('key-1', []);
      await expect(new Response(entry?.value).text()).resolves.toBe(
        'from-store'
      );

      // ...and we got here via the SUCCESSFUL-write path, not the timeout path.
      expect(handler.getTelemetrySnapshot()).toMatchObject({ 'set.write': 1 });
      expect(handler.getTelemetrySnapshot()['set.timeout']).toBeUndefined();
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
