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
describe('createWritePipeline', () => {
  const encoder = new TextEncoder();

  function makeEntry(body = 'payload'): CacheEntryLike {
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

  function makePipeline(
    overrides: { maxItemBytes?: number; disabled?: boolean } = {}
  ) {
    return createWritePipeline({
      backend,
      breaker: createCircuitBreaker({ now: () => 0 }),
      telemetry: createCacheTelemetry({ logger, now: () => 0 }),
      logger,
      maxItemBytes: overrides.maxItemBytes ?? 1_048_576,
      disabled: overrides.disabled ?? false,
      now: () => 0,
      maxPendingAgeMs: 5_000,
    });
  }

  it('writes an in-budget entry through with a fresh, undrained stream', async () => {
    const pipeline = makePipeline();

    await pipeline.write('key-1', Promise.resolve(makeEntry('body')));

    expect(backend.set).toHaveBeenCalledTimes(1);
    const [, pending] = backend.set.mock.calls[0];
    await expect(new Response((await pending).value).text()).resolves.toBe(
      'body'
    );
  });

  it('resolves when the backend rejects the write', async () => {
    backend.set.mockRejectedValue(new Error('503 Service Unavailable'));
    const pipeline = makePipeline();

    await expect(
      pipeline.write('key-1', Promise.resolve(makeEntry()))
    ).resolves.toBeUndefined();
  });

  it('resolves and skips the write when the entry is oversized', async () => {
    const pipeline = makePipeline({ maxItemBytes: 4 });

    await expect(
      pipeline.write('key-1', Promise.resolve(makeEntry('far too large')))
    ).resolves.toBeUndefined();
    expect(backend.set).not.toHaveBeenCalled();
  });

  it('resolves and skips the write when the pending entry rejects', async () => {
    const pipeline = makePipeline();

    await expect(
      pipeline.write('key-1', Promise.reject(new Error('render failed')))
    ).resolves.toBeUndefined();
    expect(backend.set).not.toHaveBeenCalled();
  });

  it('does not touch the backend when disabled', async () => {
    const pipeline = makePipeline({ disabled: true });

    await pipeline.write('key-1', Promise.resolve(makeEntry()));

    expect(backend.set).not.toHaveBeenCalled();
  });

  describe('readPending', () => {
    it('returns undefined for a key with no in-flight write', async () => {
      const pipeline = makePipeline();

      await expect(pipeline.readPending('key-1')).resolves.toBeUndefined();
    });

    it('serves an in-flight write to a concurrent reader', async () => {
      let release: () => void = () => {};
      backend.set.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          })
      );
      const pipeline = makePipeline();

      const writing = pipeline.write(
        'key-1',
        Promise.resolve(makeEntry('inflight'))
      );
      const served = await pipeline.readPending('key-1');

      expect(served).toBeDefined();
      await expect(new Response(served?.value).text()).resolves.toBe(
        'inflight'
      );

      release();
      await writing;
    });

    it('stops serving once the write has settled', async () => {
      const pipeline = makePipeline();

      await pipeline.write('key-1', Promise.resolve(makeEntry()));

      await expect(pipeline.readPending('key-1')).resolves.toBeUndefined();
    });

    /**
     * Codex `PRRT_kwDOQZgfis6QmUof`.
     *
     * The pending buffer exists to satisfy Next's set/get contract for the brief
     * window while a write settles. But if the shared write HANGS, the key never
     * leaves the map, and every later get() is served from that in-memory buffer
     * — bypassing expiration and tag checks entirely. A hung write must not be
     * able to shadow an invalidation indefinitely.
     */
    it('stops serving a hung write from the pending buffer once it goes stale', async () => {
      let current = 0;
      // A write that never settles.
      backend.set.mockImplementation(() => new Promise<void>(() => {}));
      const pipeline = createWritePipeline({
        backend,
        breaker: createCircuitBreaker({ now: () => current }),
        telemetry: createCacheTelemetry({ logger, now: () => current }),
        logger,
        maxItemBytes: 1_048_576,
        disabled: false,
        now: () => current,
        maxPendingAgeMs: 5_000,
      });

      void pipeline.write('key-1', Promise.resolve(makeEntry('shadowed')));

      // Inside the window the contract still holds.
      await expect(pipeline.readPending('key-1')).resolves.toBeDefined();

      // Past it, the buffer must no longer shadow the shared store.
      current = 5_000;
      await expect(pipeline.readPending('key-1')).resolves.toBeUndefined();
    });

    it('does not serve an entry that was rejected for being oversized', async () => {
      const pipeline = makePipeline({ maxItemBytes: 4 });

      const writing = pipeline.write(
        'key-1',
        Promise.resolve(makeEntry('far too large'))
      );
      await expect(pipeline.readPending('key-1')).resolves.toBeUndefined();
      await writing;
    });
  });
});
