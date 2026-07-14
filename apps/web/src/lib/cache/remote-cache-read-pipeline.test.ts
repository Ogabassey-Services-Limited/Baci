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
    onPendingSettled?: () => void
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
      breakers: createCacheBreakers({ now: () => 0 }),
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
});
