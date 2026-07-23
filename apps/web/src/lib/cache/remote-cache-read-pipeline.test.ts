// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createCacheBreakers } from './remote-cache-breakers.mjs';
import { createReadPipeline } from './remote-cache-read-pipeline.mjs';
import { createCacheTelemetry } from './remote-cache-telemetry.mjs';
import {
  makeBackend,
  makeEntry,
  makeLogger,
} from './remote-cache-test-fixtures';
import { createCacheTrust } from './remote-cache-trust.mjs';

describe('createReadPipeline — post-wait safety gates', () => {
  function makePipeline(
    awaitPending: () => Promise<boolean>,
    onPendingSettled?: () => void,
    breakers = createCacheBreakers({ now: () => 0 })
  ) {
    const logger = makeLogger();
    const backend = makeBackend({
      get: vi.fn().mockImplementation(async () => makeEntry('stale-store')),
    });
    const trust = createCacheTrust({ distrustMs: 5_000, now: () => 0 });
    const writes = {
      write: vi.fn(),
      awaitPending: vi.fn(async () => {
        const settled = await awaitPending();
        onPendingSettled?.();
        return settled;
      }),
    };
    const pipeline = createReadPipeline({
      backend,
      breakers,
      trust,
      telemetry: createCacheTelemetry({ logger, now: () => 0 }),
      logger,
      writes,
      maxItemBytes: 1_048_576,
      disabled: false,
      backendTimeoutMs: 200,
    });

    return { backend, pipeline, trust };
  }

  it('misses when cache trust degrades while waiting for a pending write', async () => {
    const { backend, pipeline, trust } = makePipeline(
      async () => true,
      () => trust.degrade('update_tags')
    );

    await expect(pipeline.read('key-1', [])).resolves.toBeUndefined();
    expect(backend.get).not.toHaveBeenCalled();
  });

  it('misses when waiting for a pending write reaches its deadline', async () => {
    const { backend, pipeline } = makePipeline(async () => false);

    await expect(pipeline.read('key-1', [])).resolves.toBeUndefined();
    expect(backend.get).not.toHaveBeenCalled();
  });

  it('releases a half-open probe when pending-write synchronisation aborts', async () => {
    let current = 0;
    const breakers = createCacheBreakers({
      failureThreshold: 1,
      cooldownMs: 10,
      now: () => current,
    });
    const getBreaker = breakers('get');
    expect(getBreaker.shouldAttempt()).toBe(true);
    getBreaker.recordFailure();
    current = 11;
    const awaitPending = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const { backend, pipeline } = makePipeline(
      () => awaitPending(),
      undefined,
      breakers
    );

    await expect(pipeline.read('key-1', [])).resolves.toBeUndefined();
    await expect(pipeline.read('key-1', [])).resolves.toBeDefined();
    expect(backend.get).toHaveBeenCalledTimes(1);
  });

  it('misses when trust degrades while the backend hit is being read', async () => {
    const { backend, pipeline, trust } = makePipeline(async () => true);
    backend.get.mockImplementation(async () => {
      trust.degrade('refresh_tags');
      return makeEntry('pre-invalidation');
    });

    await expect(pipeline.read('key-1', [])).resolves.toBeUndefined();
  });
});
