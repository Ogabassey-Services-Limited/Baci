// @vitest-environment node
import {
  getCacheHandler,
  getCacheHandlers,
  initializeCacheHandlers,
  setCacheHandler,
} from 'next/dist/server/use-cache/handlers.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

/**
 * REAL-REGISTRATION harness (Codex `PRRT_kwDOQZgfis6QmUob`).
 *
 * These tests drive Next's ACTUAL handler registry — `initializeCacheHandlers`
 * / `setCacheHandler` / `getCacheHandlers` imported from
 * `next/dist/server/use-cache/handlers.js` — rather than a hand-built mock,
 * because the bug they pin lives in that registry's data structures:
 *
 *   function setCacheHandler(kind, cacheHandler) {
 *     reference[handlersMapSymbol].set(kind, cacheHandler);  // MAP: replaces by kind
 *     reference[handlersSetSymbol].add(cacheHandler);        // SET: ADDS — never removes
 *   }
 *
 * The SET is seeded `new Set(map.values())` at init, so registering our adapter
 * leaves the INCUMBENT remote handler in it too. And `revalidation-utils.js`
 * iterates that SET (`getCacheHandlers()`), calling `updateTags` on every member
 * under `await Promise.all(...)`.
 *
 * Consequences if the incumbent is not evicted:
 *   (a) every revalidateTag is sent TWICE to the shared backend, and
 *   (b) the incumbent's RAW `updateTags` rejection never passes through our
 *       catch — the exit-128 process-killer stays live on the invalidation path.
 *
 * (`refreshTags` and `getExpiration` iterate the MAP via
 * `getCacheHandlerEntries()`, which IS keyed by kind, so those are correctly
 * replaced and need no eviction.)
 */

const HANDLERS_SYMBOL = Symbol.for('@next/cache-handlers');
const HANDLERS_MAP_SYMBOL = Symbol.for('@next/cache-handlers-map');
const HANDLERS_SET_SYMBOL = Symbol.for('@next/cache-handlers-set');

type Mutable = Record<symbol, unknown>;

type Backend = {
  get: Mock<(key: string, softTags: string[]) => Promise<undefined>>;
  set: Mock<() => Promise<void>>;
  refreshTags: Mock<() => Promise<void>>;
  getExpiration: Mock<() => Promise<number>>;
  updateTags: Mock<(tags: string[]) => Promise<void>>;
};

function makeBackend(): Backend {
  return {
    get: vi.fn<Backend['get']>().mockResolvedValue(undefined),
    set: vi.fn<Backend['set']>().mockResolvedValue(undefined),
    refreshTags: vi.fn<Backend['refreshTags']>().mockResolvedValue(undefined),
    getExpiration: vi.fn<Backend['getExpiration']>().mockResolvedValue(0),
    updateTags: vi.fn<Backend['updateTags']>().mockResolvedValue(undefined),
  };
}

/**
 * Replays exactly what `revalidation-utils.js#revalidateTags` does: iterate the
 * handler SET, call `updateTags` on each, and await them together.
 */
async function replayNextRevalidateTags(tags: string[]) {
  const promises: Promise<void>[] = [];
  for (const handler of getCacheHandlers() ?? []) {
    promises.push(
      (handler as { updateTags: (t: string[]) => Promise<void> }).updateTags(
        tags
      )
    );
  }
  await Promise.all(promises);
}

async function flushEventLoop() {
  for (let i = 0; i < 3; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe('real Next registration path', () => {
  const globals = globalThis as unknown as Mutable;

  let unhandled: unknown[];
  let onUnhandled: (reason: unknown) => void;

  beforeEach(() => {
    // Next's registry is global and initialises exactly once — reset it so each
    // test drives a genuinely fresh registration.
    delete globals[HANDLERS_SYMBOL];
    delete globals[HANDLERS_MAP_SYMBOL];
    delete globals[HANDLERS_SET_SYMBOL];
    vi.resetModules();

    unhandled = [];
    onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
    delete globals[HANDLERS_SYMBOL];
    delete globals[HANDLERS_MAP_SYMBOL];
    delete globals[HANDLERS_SET_SYMBOL];
  });

  /**
   * Registers exactly as `next-server.js#loadCustomCacheHandlers` does:
   * initialize first, then import the module, then setCacheHandler.
   */
  async function registerLikeNext(
    remoteBackend: Backend,
    defaultBackend: Backend
  ) {
    globals[HANDLERS_SYMBOL] = {
      RemoteCache: remoteBackend,
      DefaultCache: defaultBackend,
    };
    initializeCacheHandlers(0);
    const mod = await import('./remote-cache-handler.mjs');
    setCacheHandler('remote', mod.default);
    return mod.default;
  }

  it('evicts the wrapped incumbent from the handler SET', async () => {
    const remote = makeBackend();
    const fallback = makeBackend();

    const ours = await registerLikeNext(remote, fallback);
    const handlers = [...(getCacheHandlers() ?? [])];

    expect(handlers).toContain(ours);
    // The incumbent must NOT still be reachable — otherwise Next calls it raw.
    expect(handlers).not.toContain(remote);
    // ...while the unrelated 'default'-kind handler is left alone.
    expect(handlers).toContain(fallback);
    // And the MAP still resolves 'remote' to us.
    expect(getCacheHandler('remote')).toBe(ours);
  });

  /**
   * BLAST-RADIUS SCOPE. Our adapter — and therefore its trust/distrust state and
   * its circuit breakers — is registered for the `'remote'` kind ONLY. Next
   * resolves a handler per kind (`getCacheHandler(kind)`), and plain
   * `'use cache'` compiles to kind `'default'`, which stays on a DIFFERENT
   * handler instance we never wrap or gate.
   *
   * So a remote-cache distrust window can only ever push the 19 shared-store
   * sites to the origin. Every local `'use cache'` entry (merchant lookup, PDP
   * details, category shell, slug resolution, …) keeps serving from its own
   * handler. This is what bounds a cache blip from becoming a full-origin storm.
   */
  it('is registered for the remote kind ONLY — the default kind keeps its own handler', async () => {
    const remote = makeBackend();
    const fallback = makeBackend();

    const ours = await registerLikeNext(remote, fallback);

    expect(getCacheHandler('remote')).toBe(ours);
    // Local `'use cache'` is untouched by anything this adapter does.
    expect(getCacheHandler('default')).toBe(fallback);
    expect(getCacheHandler('default')).not.toBe(ours);
  });

  it('sends each invalidation to the shared backend exactly ONCE (no double-send)', async () => {
    const remote = makeBackend();
    const fallback = makeBackend();
    await registerLikeNext(remote, fallback);

    await replayNextRevalidateTags(['products-m1']);

    // Once — via our adapter. Not twice (adapter + raw incumbent).
    expect(remote.updateTags).toHaveBeenCalledTimes(1);
    expect(remote.updateTags).toHaveBeenCalledWith(['products-m1']);
  });

  it('produces ZERO unhandled rejections when the backend updateTags rejects', async () => {
    const remote = makeBackend();
    const fallback = makeBackend();
    remote.updateTags.mockRejectedValue(new Error('503 Service Unavailable'));

    await registerLikeNext(remote, fallback);

    // This is the promise Next awaits inside executeRevalidates(). Before the
    // eviction fix, the raw incumbent's rejection landed here uncaught.
    await expect(
      replayNextRevalidateTags(['products-m1'])
    ).resolves.toBeUndefined();
    await flushEventLoop();

    expect(unhandled).toEqual([]);
  });

  it('still reaches the shared store for invalidation (the §8 cross-instance contract)', async () => {
    const remote = makeBackend();
    const fallback = makeBackend();
    await registerLikeNext(remote, fallback);

    await replayNextRevalidateTags(['products-m1', 'categories-m1']);

    // Eviction must not mean "invalidation stops propagating" — our adapter
    // delegates it. A shared-store bust that never lands would be a far worse
    // bug than the one we are fixing.
    expect(remote.updateTags).toHaveBeenCalledWith([
      'products-m1',
      'categories-m1',
    ]);
  });

  it('keeps a single shared instance reachable when Next maps default+remote to it', async () => {
    // With no platform RemoteCache, Next points BOTH kinds at one in-memory
    // handler. Evicting it from the SET is still safe because our adapter
    // delegates updateTags to that very instance — it is busted exactly once.
    const shared = makeBackend();
    globals[HANDLERS_SYMBOL] = { DefaultCache: shared };
    initializeCacheHandlers(0);
    const mod = await import('./remote-cache-handler.mjs');
    setCacheHandler('remote', mod.default);

    await replayNextRevalidateTags(['products-m1']);

    expect(shared.updateTags).toHaveBeenCalledTimes(1);
    expect(shared.updateTags).toHaveBeenCalledWith(['products-m1']);
  });
});
