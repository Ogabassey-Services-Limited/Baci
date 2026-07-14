// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The entry module Next loads for `cacheHandlers.remote`.
 *
 * Its one job beyond wiring config is to WRAP the shared store rather than
 * replace it. Replacing it with a local cache would silently break every
 * `revalidateTag` contract (inventory §8) — so these tests pin the delegation.
 */

const HANDLERS_SYMBOL = Symbol.for('@next/cache-handlers');
const HANDLERS_MAP_SYMBOL = Symbol.for('@next/cache-handlers-map');

type Mutable = Record<symbol, unknown>;

function makeBackend() {
  return {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    refreshTags: vi.fn().mockResolvedValue(undefined),
    getExpiration: vi.fn().mockResolvedValue(0),
    updateTags: vi.fn().mockResolvedValue(undefined),
  };
}

async function importHandler() {
  vi.resetModules();
  const mod = await import('./remote-cache-handler.mjs');
  return mod.default;
}

describe('remote-cache-handler entry module', () => {
  const globals = globalThis as unknown as Mutable;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete globals[HANDLERS_SYMBOL];
    delete globals[HANDLERS_MAP_SYMBOL];
    delete process.env.BACI_REMOTE_CACHE_DISABLED;
    delete process.env.BACI_REMOTE_CACHE_MAX_ITEM_BYTES;
  });

  afterEach(() => {
    delete globals[HANDLERS_SYMBOL];
    delete globals[HANDLERS_MAP_SYMBOL];
    delete process.env.BACI_REMOTE_CACHE_DISABLED;
    delete process.env.BACI_REMOTE_CACHE_MAX_ITEM_BYTES;
  });

  it('exports a complete Next CacheHandler', async () => {
    const handler = await importHandler();

    expect(typeof handler.get).toBe('function');
    expect(typeof handler.set).toBe('function');
    expect(typeof handler.refreshTags).toBe('function');
    expect(typeof handler.getExpiration).toBe('function');
    expect(typeof handler.updateTags).toBe('function');
  });

  it("wraps the platform's managed RemoteCache when the host injects one", async () => {
    // This is how Vercel injects its managed shared store.
    const platform = makeBackend();
    globals[HANDLERS_SYMBOL] = { RemoteCache: platform };

    const handler = await importHandler();
    await handler.get('key-1', ['soft']);

    // Delegation proves the SHARED store is still in play — the adapter adds
    // resilience, it does not substitute a local cache.
    expect(platform.get).toHaveBeenCalledWith('key-1', ['soft']);
  });

  it('propagates tag invalidation to the shared store (the §8 invariant)', async () => {
    const platform = makeBackend();
    globals[HANDLERS_SYMBOL] = { RemoteCache: platform };

    const handler = await importHandler();
    await handler.updateTags(['products-m1'], { expire: 60 });

    expect(platform.updateTags).toHaveBeenCalledWith(['products-m1'], {
      expire: 60,
    });
  });

  it("falls back to the handler Next already installed for 'remote' when there is no platform store", async () => {
    // Local dev / `next build` / self-host: Next seeds 'remote' with its default
    // in-memory handler. Wrapping it preserves build-time cache reuse instead of
    // silently disabling caching for 2,939 prerendered pages.
    const fallback = makeBackend();
    globals[HANDLERS_MAP_SYMBOL] = new Map([['remote', fallback]]);

    const handler = await importHandler();
    await handler.get('key-1', []);

    expect(fallback.get).toHaveBeenCalledWith('key-1', []);
  });

  it('prefers the platform RemoteCache over the installed map entry', async () => {
    const platform = makeBackend();
    const fallback = makeBackend();
    globals[HANDLERS_SYMBOL] = { RemoteCache: platform };
    globals[HANDLERS_MAP_SYMBOL] = new Map([['remote', fallback]]);

    const handler = await importHandler();
    await handler.get('key-1', []);

    expect(platform.get).toHaveBeenCalledTimes(1);
    expect(fallback.get).not.toHaveBeenCalled();
  });

  it('degrades to miss-only (never recurses) when no backend can be resolved', async () => {
    const handler = await importHandler();

    // Must not blow up, must not self-delegate.
    await expect(handler.get('key-1', [])).resolves.toBeUndefined();
    await expect(
      handler.set(
        'key-1',
        Promise.resolve({
          value: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('x'));
              controller.close();
            },
          }),
          tags: [],
          stale: 300,
          timestamp: 1,
          expire: 86_400,
          revalidate: 300,
        })
      )
    ).resolves.toBeUndefined();
  });

  it('never delegates to itself if the map already holds this handler', async () => {
    // Guards against the setCacheHandler() ordering trap: once Next installs us
    // as 'remote', reading the map back would be infinite recursion.
    const mod = await import('./remote-cache-handler.mjs');
    globals[HANDLERS_MAP_SYMBOL] = new Map([['remote', mod.default]]);

    const handler = await importHandler();

    await expect(handler.get('key-1', [])).resolves.toBeUndefined();
  });

  /**
   * Without this wiring the adapter is dead code and every remote cache write
   * silently goes back to the framework default that kills the process.
   */
  describe('next.config.ts registration', () => {
    const appRoot = path.resolve(__dirname, '../../..');
    const configPath = path.join(appRoot, 'next.config.ts');

    it('registers the handler as cacheHandlers.remote', () => {
      const config = readFileSync(configPath, 'utf8');

      expect(config).toMatch(/cacheHandlers:\s*{/);
      expect(config).toContain('src/lib/cache/remote-cache-handler.mjs');
    });

    it('points at a module that actually exists on disk', () => {
      // Next `require.resolve()`s this path during build-trace collection — a
      // stale path fails the production build, not the test suite.
      expect(
        existsSync(path.join(appRoot, 'src/lib/cache/remote-cache-handler.mjs'))
      ).toBe(true);
    });
  });

  it('honours the BACI_REMOTE_CACHE_DISABLED kill switch', async () => {
    const platform = makeBackend();
    globals[HANDLERS_SYMBOL] = { RemoteCache: platform };
    process.env.BACI_REMOTE_CACHE_DISABLED = '1';

    const handler = await importHandler();
    await handler.get('key-1', []);

    expect(platform.get).not.toHaveBeenCalled();
    // Invalidation still propagates — the kill switch trades hit-rate for
    // safety, never correctness.
    await handler.updateTags(['products-m1']);
    expect(platform.updateTags).toHaveBeenCalled();
  });
});
