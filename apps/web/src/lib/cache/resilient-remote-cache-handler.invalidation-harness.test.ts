// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type CacheHandlerLike,
  encodeEntry,
  flushEventLoop,
  PRODUCT,
  renderRouteThroughCache,
} from './remote-cache-harness-fixtures';
import { createResilientRemoteCacheHandler } from './resilient-remote-cache-handler.mjs';

/**
 * DROPPED INVALIDATIONS, end to end.
 *
 * This is the one failure on the handler that is DURABLE. A failed read
 * self-heals; a failed BUST does not — the shared store keeps handing the
 * pre-mutation entry to every instance until its own `cacheLife.revalidate`
 * window lapses (`next.config.ts`: merchant 60s, products 300s, **categories
 * 3600s**). One transient blip during a category edit = up to an hour of stale
 * storefront.
 *
 * So: retry the blip (repair it), and only then treat it as a drop.
 */
describe('remote cache harness — dropped invalidations', () => {
  let unhandled: unknown[];
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let onUnhandled: (reason: unknown) => void;

  beforeEach(() => {
    unhandled = [];
    onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit was called');
    }) as never);
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
    exitSpy.mockRestore();
  });

  const STALE = { ...PRODUCT, price: 1_000, name: 'STALE — pre-invalidation' };

  /** A healthy store that would happily keep serving the pre-mutation entry. */
  function backendServingStale(): CacheHandlerLike {
    return {
      get: vi
        .fn()
        .mockImplementation(async () => encodeEntry(STALE, ['products-m1'])),
      set: vi.fn().mockResolvedValue(undefined),
      refreshTags: vi.fn().mockResolvedValue(undefined),
      getExpiration: vi.fn().mockResolvedValue(0),
      updateTags: vi.fn().mockResolvedValue(undefined),
    };
  }

  function handlerWithInstantRetry(backend: CacheHandlerLike) {
    return createResilientRemoteCacheHandler({
      backend,
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      backendTimeoutMs: 25,
      now: () => 0,
      // Collapse the backoff so the test does not actually sleep.
      retryOptions: { sleep: async () => undefined },
    });
  }

  it('TRANSIENT failure is REPAIRED — the bust lands, nothing goes stale', async () => {
    const backend = backendServingStale();
    (backend.updateTags as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValue(undefined);
    const handler = handlerWithInstantRetry(backend);

    await handler.updateTags(['categories-m1']);

    // It LANDED on the shared store, so every instance sees the bust.
    expect(backend.updateTags).toHaveBeenCalledTimes(2);
    expect(handler.getTelemetrySnapshot()).toMatchObject({
      'update_tags.retry_success': 1,
    });
    expect(
      handler.getTelemetrySnapshot()['update_tags.dropped']
    ).toBeUndefined();

    // ...and the cache stays usable: there is nothing left to distrust.
    const pendingRevalidateWrites: Promise<void>[] = [];
    const response = await renderRouteThroughCache(
      handler,
      `products/${PRODUCT.slug}`,
      ['products-m1'],
      async () => PRODUCT,
      pendingRevalidateWrites
    );
    expect(response.status).toBe(200);

    await Promise.all(pendingRevalidateWrites);
    await flushEventLoop();
    expect(unhandled).toEqual([]);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('SUSTAINED failure is a recorded DROP: reads degrade to origin, no unhandled rejection, no exit', async () => {
    const backend = backendServingStale();
    (backend.updateTags as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('503 Service Unavailable')
    );
    const handler = handlerWithInstantRetry(backend);
    const pendingRevalidateWrites: Promise<void>[] = [];

    // Next awaits this in executeRevalidates() AFTER the response — it must
    // resolve, whatever happened.
    await expect(
      handler.updateTags(['categories-m1'])
    ).resolves.toBeUndefined();

    expect(handler.getTelemetrySnapshot()).toMatchObject({
      'update_tags.dropped': 1,
    });

    // The shared store STILL holds the pre-mutation entry — that is the durable
    // residual only the outbox can close. But this instance now refuses to serve
    // it and goes to the origin instead.
    const response = await renderRouteThroughCache(
      handler,
      `products/${PRODUCT.slug}`,
      ['products-m1'],
      async () => PRODUCT,
      pendingRevalidateWrites
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual(PRODUCT);
    expect(response.body).not.toEqual(STALE);

    await Promise.all(pendingRevalidateWrites);
    await flushEventLoop();
    expect(unhandled).toEqual([]);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('does not clear an earlier drop when an unrelated invalidation succeeds', async () => {
    let current = 0;
    const backend = backendServingStale();
    (backend.updateTags as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValue(undefined);
    const handler = createResilientRemoteCacheHandler({
      backend,
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      now: () => current,
      retryOptions: { attempts: 1, sleep: async () => undefined },
    });

    await handler.updateTags(['categories-m1']);
    await handler.updateTags(['products-m2']);

    current = 60_000;
    await expect(handler.get('key-1', [])).resolves.toBeUndefined();
    expect(backend.updateTags).toHaveBeenCalledTimes(2);
    expect(backend.get).not.toHaveBeenCalled();
  });
});
