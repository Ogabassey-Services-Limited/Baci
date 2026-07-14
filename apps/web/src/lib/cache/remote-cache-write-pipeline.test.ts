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
    overrides: {
      maxItemBytes?: number;
      disabled?: boolean;
      backendTimeoutMs?: number;
    } = {}
  ) {
    return createWritePipeline({
      backend,
      breaker: createCircuitBreaker({ now: () => 0 }),
      telemetry: createCacheTelemetry({ logger, now: () => 0 }),
      logger,
      maxItemBytes: overrides.maxItemBytes ?? 1_048_576,
      disabled: overrides.disabled ?? false,
      backendTimeoutMs: overrides.backendTimeoutMs ?? 200,
      now: () => 0,
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

  /**
   * CodeRabbit: a `pendingEntry` that never settles — the RENDER hanging, as
   * opposed to the backend hanging. `bufferAndGate`'s `await pendingEntry` had no
   * deadline, so the promise Next awaits after the response would never resolve.
   */
  it('resolves when the pendingEntry (the render) never settles', async () => {
    const pipeline = makePipeline({ backendTimeoutMs: 25 });

    await expect(
      pipeline.write('key-1', new Promise<CacheEntryLike>(() => {}))
    ).resolves.toBeUndefined();
    expect(backend.set).not.toHaveBeenCalled();
  });

  it('does not touch the backend when disabled', async () => {
    const pipeline = makePipeline({ disabled: true });

    await pipeline.write('key-1', Promise.resolve(makeEntry()));

    expect(backend.set).not.toHaveBeenCalled();
  });

  describe('awaitPending (synchronisation point, NOT a cache)', () => {
    it('returns immediately for a key with no in-flight write', async () => {
      const pipeline = makePipeline();

      await expect(pipeline.awaitPending('key-1')).resolves.toBe(true);
    });

    it('waits for an in-flight write to settle before returning', async () => {
      let release: () => void = () => {};
      let settled = false;
      backend.set.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            release = () => {
              settled = true;
              resolve();
            };
          })
      );
      const pipeline = makePipeline();

      const writing = pipeline.write(
        'key-1',
        Promise.resolve(makeEntry('inflight'))
      );
      // Let the entry buffer and the backend write actually start.
      await new Promise((resolve) => setImmediate(resolve));

      const waiting = pipeline.awaitPending('key-1').then(() => {
        // Next's contract: the handler must WAIT for the set to finish.
        expect(settled).toBe(true);
      });

      release();
      await waiting;
      await writing;
    });

    /**
     * Codex `PRRT_kwDOQZgfis6Qmv0v` (round 2). A HUNG set() never reaches
     * catch/finally, so without a deadline the pending record would never be
     * cleaned and every later read of that key would wedge behind it.
     */
    it('does not wait forever on a hung write', async () => {
      backend.set.mockImplementation(() => new Promise<void>(() => {}));
      const pipeline = makePipeline({ backendTimeoutMs: 25 });

      void pipeline.write('key-1', Promise.resolve(makeEntry('hung')));

      // Bounded: it resolves rather than hanging with the write.
      await expect(pipeline.awaitPending('key-1')).resolves.toBe(false);
    });

    it('resolves the write itself even when the backend hangs, and counts a failure', async () => {
      backend.set.mockImplementation(() => new Promise<void>(() => {}));
      const breaker = createCircuitBreaker({
        failureThreshold: 1,
        now: () => 0,
      });
      const pipeline = createWritePipeline({
        backend,
        breaker,
        telemetry: createCacheTelemetry({ logger, now: () => 0 }),
        logger,
        maxItemBytes: 1_048_576,
        disabled: false,
        backendTimeoutMs: 25,
        now: () => 0,
      });

      // The promise Next awaits after the response must still settle.
      await expect(
        pipeline.write('key-1', Promise.resolve(makeEntry()))
      ).resolves.toBeUndefined();

      // ...and the timeout must count as a breaker failure, so the circuit opens.
      expect(breaker.getState()).toBe('open');
    });
  });
});
