// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encodeEntry,
  flushEventLoop,
  makeHostileBackend,
  PRODUCT,
  renderRouteThroughCache,
} from './remote-cache-harness-fixtures';
import { createResilientRemoteCacheHandler } from './resilient-remote-cache-handler.mjs';

describe('remote cache harness — framework-default proof, real 404s, recovery', () => {
  let unhandled: unknown[];
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let onUnhandled: (reason: unknown) => void;

  beforeEach(() => {
    unhandled = [];
    onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    // `exit 128` is the observed production symptom — assert nothing calls it.
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit was called');
    }) as never);
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
    exitSpy.mockRestore();
  }); /* ---------------------------------------------------------------- */
  /*  The bug being fixed — proof the harness has teeth                */
  /* ---------------------------------------------------------------- */

  it('DOCUMENTS the framework-default failure: an unwrapped backend rejects the set() that Next awaits after the 200', async () => {
    const rawBackend = makeHostileBackend(new Error('503 Service Unavailable'));

    // This is what rides on the *default* handler today. The promise Next
    // pushes onto pendingRevalidateWrites rejects -> unhandled -> exit 128.
    const pending = rawBackend.set(
      `products/${PRODUCT.slug}`,
      Promise.resolve(encodeEntry(PRODUCT, ['products-m1']))
    );

    await expect(pending).rejects.toThrow('503 Service Unavailable');

    // The adapter turns exactly that into a resolved no-op.
    const handler = createResilientRemoteCacheHandler({
      backend: makeHostileBackend(new Error('503 Service Unavailable')),
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    await expect(
      handler.set(
        `products/${PRODUCT.slug}`,
        Promise.resolve(encodeEntry(PRODUCT, ['products-m1']))
      )
    ).resolves.toBeUndefined();
  });

  /* ---------------------------------------------------------------- */
  /*  Real 404s must survive the adapter                               */
  /* ---------------------------------------------------------------- */

  it('preserves a genuine 404 (absence is only ever decided by the origin)', async () => {
    const handler = createResilientRemoteCacheHandler({
      backend: makeHostileBackend(new Error('503 Service Unavailable')),
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    const pendingRevalidateWrites: Promise<void>[] = [];

    const response = await renderRouteThroughCache(
      handler,
      'products/does-not-exist',
      ['products-m1'],
      async () => null,
      pendingRevalidateWrites
    );

    expect(response.status).toBe(404);
    // ...and a transient cache failure never *created* that 404: the origin did.
    expect(unhandled).toEqual([]);
  });

  it('keeps serving correct data when the backend recovers mid-flight', async () => {
    const backend = makeHostileBackend(new Error('503 Service Unavailable'));
    let current = 0;
    const handler = createResilientRemoteCacheHandler({
      backend,
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      failureThreshold: 2,
      cooldownMs: 30_000,
      now: () => current,
    });
    const pendingRevalidateWrites: Promise<void>[] = [];

    await renderRouteThroughCache(
      handler,
      'k',
      ['t'],
      async () => PRODUCT,
      pendingRevalidateWrites
    );
    await renderRouteThroughCache(
      handler,
      'k',
      ['t'],
      async () => PRODUCT,
      pendingRevalidateWrites
    );

    // Backend heals.
    (backend.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      encodeEntry(PRODUCT, ['t'])
    );
    (backend.refreshTags as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    (backend.getExpiration as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    current = 30_000;

    const response = await renderRouteThroughCache(
      handler,
      'k',
      ['t'],
      async () => PRODUCT,
      pendingRevalidateWrites
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual(PRODUCT);
    await Promise.all(pendingRevalidateWrites);
    await flushEventLoop();
    expect(unhandled).toEqual([]);
  });
});
