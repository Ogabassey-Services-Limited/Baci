// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type FakeLogger,
  makeBackend,
  makeEntry,
  makeLogger,
} from './remote-cache-test-fixtures';
import { createResilientRemoteCacheHandler } from './resilient-remote-cache-handler.mjs';

/**
 * INVALIDATION — the one failure on this handler that is DURABLE.
 *
 * A failed read self-heals: the route recomputes and the next request retries.
 * A failed BUST does not. The shared store keeps serving the pre-mutation entry
 * to every instance until its own `cacheLife.revalidate` window lapses, and from
 * `next.config.ts` those windows are:
 *
 *   merchant   60s
 *   products   300s
 *   categories 3600s   ← a FULL HOUR
 *
 * So one transient blip while a merchant edits a category can mean an hour of
 * stale storefront. Hence the bounded retry, and hence a much longer,
 * reason-scoped distrust window when the retry budget is exhausted.
 */
describe('createResilientRemoteCacheHandler — invalidation', () => {
  let logger: FakeLogger;

  beforeEach(() => {
    logger = makeLogger();
  });

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

    /**
     * A dropped invalidation is the one failure on this handler that is DURABLE.
     * The shared store keeps serving the pre-mutation entry until its own
     * `cacheLife.revalidate` window lapses — and from `next.config.ts` that is
     * 60s (merchant) / 300s (products) / **3600s (categories)**. One transient
     * blip while a merchant edits a category = up to an HOUR of stale storefront.
     *
     * So this is the one operation that gets a bounded retry: the dominant
     * real-world failure is a momentary blip, and a couple of jittered retries
     * REPAIR it within a second instead of merely surviving it.
     */
    it('REPAIRS a transient invalidation failure instead of dropping it', async () => {
      const updateTags = vi
        .fn()
        .mockRejectedValueOnce(new Error('503 Service Unavailable'))
        .mockResolvedValue(undefined);
      const backend = makeBackend({ updateTags });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        retryOptions: { sleep: async () => undefined },
      });

      await handler.updateTags(['categories-m1']);

      // The bust LANDED. No staleness, nothing dropped, no error.
      expect(updateTags).toHaveBeenCalledTimes(2);
      expect(handler.getTelemetrySnapshot()).toMatchObject({
        'update_tags.retry_success': 1,
      });
      expect(
        handler.getTelemetrySnapshot()['update_tags.dropped']
      ).toBeUndefined();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('keeps reads trusted after a repaired invalidation (nothing to distrust)', async () => {
      const backend = makeBackend({
        updateTags: vi
          .fn()
          .mockRejectedValueOnce(new Error('503'))
          .mockResolvedValue(undefined),
        get: vi.fn().mockImplementation(async () => makeEntry('fresh')),
      });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        retryOptions: { sleep: async () => undefined },
      });

      await handler.updateTags(['categories-m1']);

      // The store is correct now, so the cache stays usable.
      await expect(handler.get('key-1', [])).resolves.toBeDefined();
    });

    /**
     * After the retry budget is exhausted the drop is real. Trust is degraded for
     * a REASON-SCOPED window long enough to cover the worst-case staleness (1h),
     * not the 5s transient backstop — otherwise we would re-serve the stale entry
     * five seconds later.
     */
    it('degrades reads for the full staleness window after a genuine drop', async () => {
      let current = 0;
      const backend = makeBackend({
        updateTags: vi.fn().mockRejectedValue(new Error('503')),
        get: vi.fn().mockImplementation(async () => makeEntry('stale')),
      });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        now: () => current,
        retryOptions: { sleep: async () => undefined },
      });

      await handler.updateTags(['categories-m1']);

      // Well past the 5s transient backstop, and still degraded — because the
      // shared store can hold that stale category entry for a full hour.
      current = 60_000;
      await expect(handler.get('key-1', [])).resolves.toBeUndefined();
      expect(backend.get).not.toHaveBeenCalled();

      // Past the worst-case cacheLife window, the entry can no longer be stale.
      current = 3_600_001;
      await expect(handler.get('key-1', [])).resolves.toBeDefined();
    });

    it('resolves (never rejects) when updateTags is dropped, and logs it as an error', async () => {
      const backend = makeBackend({
        updateTags: vi.fn().mockRejectedValue(new Error('503')),
      });
      const handler = createResilientRemoteCacheHandler({
        backend,
        logger,
        // Exhaust the retry budget instantly.
        retryOptions: { sleep: async () => undefined },
      });

      await expect(
        handler.updateTags(['products-m1'])
      ).resolves.toBeUndefined();

      // A dropped invalidation is a freshness bug — it must be loud.
      expect(logger.error).toHaveBeenCalled();
      expect(handler.getTelemetrySnapshot()).toMatchObject({
        'update_tags.dropped': 1,
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
});
