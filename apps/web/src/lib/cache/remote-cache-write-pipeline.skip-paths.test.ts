// @vitest-environment node
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { createCircuitBreaker } from './remote-cache-circuit-breaker.mjs';
import { createCacheTelemetry } from './remote-cache-telemetry.mjs';
import { createWritePipeline } from './remote-cache-write-pipeline.mjs';

/** Mirrors Next 16's `CacheEntry` (server/lib/cache-handlers/types.d.ts). */
type CacheEntryLike = {
  value: ReadableStream<Uint8Array>;
  tags: string[];
  stale: number;
  timestamp: number;
  expire: number;
  revalidate: number;
};

/**
 * The write path is the one that kills processes: Next awaits this promise only
 * AFTER the response is on the wire, so it must resolve on every failure mode.
 */
/**
 * The skip paths — kill switch and circuit-open — must STILL attach a handler to
 * the framework's `pendingEntry` promise. See the block doc below.
 */
describe('createWritePipeline — skip paths', () => {
  const encoder = new TextEncoder();

  type Backend = {
    get: Mock<
      (
        cacheKey: string,
        softTags: string[]
      ) => Promise<CacheEntryLike | undefined>
    >;
    set: Mock<
      (cacheKey: string, pendingEntry: Promise<CacheEntryLike>) => Promise<void>
    >;
    refreshTags: Mock<() => Promise<void>>;
    getExpiration: Mock<(tags: string[]) => Promise<number>>;
    updateTags: Mock<
      (tags: string[], durations?: { expire?: number }) => Promise<void>
    >;
  };

  let backend: Backend;
  let logger: {
    log: Mock<(message: string) => void>;
    warn: Mock<(message: string) => void>;
    error: Mock<(message: string) => void>;
  };

  beforeEach(() => {
    backend = {
      get: vi.fn<Backend['get']>().mockResolvedValue(undefined),
      set: vi.fn<Backend['set']>().mockResolvedValue(undefined),
      refreshTags: vi.fn<Backend['refreshTags']>().mockResolvedValue(undefined),
      getExpiration: vi.fn<Backend['getExpiration']>().mockResolvedValue(0),
      updateTags: vi.fn<Backend['updateTags']>().mockResolvedValue(undefined),
    };
    logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  function makePipeline(overrides: { disabled?: boolean } = {}) {
    return createWritePipeline({
      backend,
      breaker: createCircuitBreaker({ now: () => 0 }),
      telemetry: createCacheTelemetry({ logger, now: () => 0 }),
      logger,
      maxItemBytes: 1_048_576,
      disabled: overrides.disabled ?? false,
      backendTimeoutMs: 200,
      now: () => 0,
    });
  }

  void encoder;

  /**
   * Codex `PRRT_kwDOQZgfis6QoFgm` — a REGRESSION introduced by moving the cheap
   * gates ahead of buffering.
   *
   * When we skip the write (kill switch, or circuit open) we never await
   * `pendingEntry`. If the render LATER rejects, that framework promise has no
   * handler attached, so Node raises an unhandled rejection AFTER the response
   * has already been sent — the exact exit-128 process-kill this whole adapter
   * exists to contain, let back in through the skip path.
   */
  describe('skip paths must still handle the framework promise', () => {
    let unhandled: unknown[];
    let onUnhandled: (reason: unknown) => void;

    beforeEach(() => {
      unhandled = [];
      onUnhandled = (reason: unknown) => unhandled.push(reason);
      process.on('unhandledRejection', onUnhandled);
    });

    afterEach(() => {
      process.off('unhandledRejection', onUnhandled);
    });

    async function flush() {
      for (let i = 0; i < 3; i += 1) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    it('raises no unhandled rejection when the render rejects after a DISABLED skip', async () => {
      const pipeline = makePipeline({ disabled: true });

      // A render that fails only after we have already skipped the write.
      const pendingEntry = new Promise<CacheEntryLike>((_resolve, reject) => {
        setTimeout(() => reject(new Error('render threw late')), 10);
      });

      await expect(
        pipeline.write('key-1', pendingEntry)
      ).resolves.toBeUndefined();
      await new Promise((resolve) => setTimeout(resolve, 30));
      await flush();

      expect(unhandled).toEqual([]);
    });

    it('raises no unhandled rejection when the render rejects after a CIRCUIT-OPEN skip', async () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 1,
        now: () => 0,
      });
      breaker.recordFailure(); // circuit now open
      const pipeline = createWritePipeline({
        backend,
        breaker,
        telemetry: createCacheTelemetry({ logger, now: () => 0 }),
        logger,
        maxItemBytes: 1_048_576,
        disabled: false,
        backendTimeoutMs: 200,
        now: () => 0,
      });

      const pendingEntry = new Promise<CacheEntryLike>((_resolve, reject) => {
        setTimeout(() => reject(new Error('render threw late')), 10);
      });

      await expect(
        pipeline.write('key-1', pendingEntry)
      ).resolves.toBeUndefined();
      expect(backend.set).not.toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 30));
      await flush();

      expect(unhandled).toEqual([]);
    });
  });
});
