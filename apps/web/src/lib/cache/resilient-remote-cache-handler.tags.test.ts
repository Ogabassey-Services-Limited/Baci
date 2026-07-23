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
