// @ts-check

import { DEFAULT_MAX_ITEM_BYTES } from './remote-cache-entry-buffer.mjs';
import {
  createResilientRemoteCacheHandler,
  RESILIENT_REMOTE_CACHE_BRAND,
} from './resilient-remote-cache-handler.mjs';

/**
 * Entry module for `cacheHandlers.remote` in `next.config.ts`.
 *
 * ## How Next loads this (verified against Next 16.2.9 source)
 *
 *  - `build/collect-build-traces.js` → `require.resolve(<path>)`, so the module
 *    (and its imports) are traced into the deployed function. It must therefore
 *    be plain, Node-resolvable JavaScript — a `.ts` file would throw here.
 *  - `server/next-server.js#loadCustomCacheHandlers` and
 *    `export/helpers/create-incremental-cache.js` →
 *    `initializeCacheHandlers()` first, then
 *    `setCacheHandler(kind, interopDefault(await import(pathToFileURL(...))))`.
 *    The DEFAULT EXPORT of this module is the handler *instance*.
 *
 * That ordering is what makes the wrapping below sound: by the time this module
 * is evaluated, Next has already installed its own `'remote'` handler (the
 * platform's managed store, or its in-memory default), and it replaces that
 * entry with ours immediately afterwards. So we capture the incumbent AT MODULE
 * EVALUATION — reading it later would hand us *ourselves* and recurse forever.
 *
 * ## Why wrap instead of replace
 *
 * Per the PR-4 inventory's §8 correction, every remaining `'use cache: remote'`
 * site has a live `revalidateTag` contract. `revalidateTag` only propagates
 * across instances through the SHARED store, so substituting a local cache would
 * silently serve stale data on every other instance. We keep the shared store
 * and make it *safe* — that is the entire thesis of PR 4.
 *
 * @typedef {import('./remote-cache-types.mjs').CacheHandler} CacheHandler
 */

const HANDLERS_SYMBOL = Symbol.for('@next/cache-handlers');
const HANDLERS_MAP_SYMBOL = Symbol.for('@next/cache-handlers-map');
const HANDLERS_SET_SYMBOL = Symbol.for('@next/cache-handlers-set');

/**
 * A backend that caches nothing. Used only when no shared store can be
 * resolved: miss-only is always CORRECT (every read falls through to the
 * origin), merely slower — never wrong, and never recursive.
 *
 * @type {CacheHandler}
 */
const MISS_ONLY_BACKEND = {
  get: async () => undefined,
  set: async () => undefined,
  refreshTags: async () => undefined,
  getExpiration: async () => 0,
  updateTags: async () => undefined,
};

/**
 * @param {unknown} candidate
 * @returns {candidate is CacheHandler}
 */
function isCacheHandler(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  const value = /** @type {Record<string, unknown>} */ (candidate);
  return (
    typeof value.get === 'function' &&
    typeof value.set === 'function' &&
    typeof value.updateTags === 'function'
  );
}

/**
 * True when the candidate is one of OUR adapters. Delegating to it would mean
 * delegating to ourselves — infinite recursion. See the brand's docs.
 *
 * @param {unknown} candidate
 * @returns {boolean}
 */
function isResilientAdapter(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  return (
    /** @type {Record<symbol, unknown>} */ (candidate)[
      RESILIENT_REMOTE_CACHE_BRAND
    ] === true
  );
}

/**
 * Resolves the shared store this adapter protects. MUST be called at module
 * evaluation, before Next swaps us into the handler map.
 *
 * @returns {{ backend: CacheHandler, source: string }}
 */
function resolveSharedBackend() {
  const globals = /** @type {Record<symbol, unknown>} */ (
    /** @type {unknown} */ (globalThis)
  );

  // 1. The platform's managed remote cache (this is how Vercel injects it).
  //    Never overwritten by setCacheHandler, so it is the safest source.
  const injected = /** @type {{ RemoteCache?: unknown } | undefined} */ (
    globals[HANDLERS_SYMBOL]
  );
  if (
    injected &&
    isCacheHandler(injected.RemoteCache) &&
    !isResilientAdapter(injected.RemoteCache)
  ) {
    return { backend: injected.RemoteCache, source: 'platform-remote-cache' };
  }

  // 2. Whatever Next just installed for 'remote' (its in-memory default during
  //    `next build` and local dev). Wrapping it keeps build-time cache reuse.
  const map = /** @type {Map<string, unknown> | undefined} */ (
    globals[HANDLERS_MAP_SYMBOL]
  );
  const incumbent = map?.get('remote');
  if (isCacheHandler(incumbent) && !isResilientAdapter(incumbent)) {
    return { backend: incumbent, source: 'next-default-handler' };
  }

  return { backend: MISS_ONLY_BACKEND, source: 'none' };
}

/**
 * Removes the handler we wrap from Next's handler SET.
 *
 * WHY THIS IS LOAD-BEARING (Next 16.2.9, `use-cache/handlers.js`):
 *
 *     function setCacheHandler(kind, cacheHandler) {
 *       reference[handlersMapSymbol].set(kind, cacheHandler);  // replaces by kind
 *       reference[handlersSetSymbol].add(cacheHandler);        // ADDS — never removes
 *     }
 *
 * The SET is seeded `new Set(map.values())` during `initializeCacheHandlers`, so
 * registering us leaves the INCUMBENT remote handler in it as well.
 * `revalidation-utils.js#revalidateTags` iterates that SET via
 * `getCacheHandlers()` and calls `updateTags` on EVERY member under
 * `await Promise.all(...)`. Left alone, that means:
 *
 *   1. every `revalidateTag` is sent to the shared backend TWICE (once by us,
 *      once by the raw incumbent), and
 *   2. the raw incumbent's rejection never passes through our catch — so the
 *      exit-128 process-killer this adapter exists to fix would still be live on
 *      the invalidation path.
 *
 * Evicting the wrapped instance is safe: our `updateTags` delegates to it, so it
 * still receives every bust — exactly once. Any OTHER handler in the set (e.g.
 * the distinct 'default'-kind handler) is untouched. And if Next mapped BOTH
 * kinds to one instance, that instance is still busted once through us, because
 * `updateTags` is instance-level, not kind-level.
 *
 * (`refreshTags` and `getExpiration` iterate the MAP via
 * `getCacheHandlerEntries()`, which IS keyed by kind and therefore already
 * replaced. Only the SET needs fixing.)
 *
 * @param {CacheHandler} wrapped
 * @returns {void}
 */
function evictWrappedBackendFromHandlerSet(wrapped) {
  const globals = /** @type {Record<symbol, unknown>} */ (
    /** @type {unknown} */ (globalThis)
  );
  const handlerSet = globals[HANDLERS_SET_SYMBOL];
  if (handlerSet instanceof Set) {
    handlerSet.delete(wrapped);
  }
}

/**
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function readIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const disabled =
  process.env.BACI_REMOTE_CACHE_DISABLED === '1' ||
  process.env.BACI_REMOTE_CACHE_DISABLED === 'true';

/**
 * Item size cap — 1 MiB.
 *
 * Evidence (PR-4 inventory §0/§2, measured 2026-07-12): the largest legitimate
 * entries on this handler are the hydrated home/launch product reads at
 * ~100–150 KB (50 products), the ogabassey product-slug set at ~50–100 KB
 * (1,333 slugs, grows with the catalogue), and the capped category product-ID
 * list at ~80 KB (2,000 UUIDs). The platform blog sitemap read would reach
 * ~250 KB at its ≤5,000-row ceiling. 1 MiB leaves ~4x headroom over the largest
 * projected entry while still refusing the pathological unbounded writes this
 * PR series exists to stop (the pre-#3017 cluster-posts entry was ~400 KB and
 * climbing). An oversized item is precisely what fails a remote write, so
 * refusing it locally converts a process-killing rejection into a logged skip.
 */
const maxItemBytes = readIntEnv(
  'BACI_REMOTE_CACHE_MAX_ITEM_BYTES',
  DEFAULT_MAX_ITEM_BYTES
);

const { backend, source } = resolveSharedBackend();

if (source === 'none') {
  console.warn(
    '[resilient-remote-cache] no shared cache backend resolved — running miss-only. Reads fall through to the origin (correct, but uncached).'
  );
}

/** @type {ReturnType<typeof createResilientRemoteCacheHandler>} */
const handler = createResilientRemoteCacheHandler({
  backend,
  maxItemBytes,
  failureThreshold: readIntEnv('BACI_REMOTE_CACHE_FAILURE_THRESHOLD', 5),
  cooldownMs: readIntEnv('BACI_REMOTE_CACHE_COOLDOWN_MS', 30_000),
  disabled,
});

// Next adds us to the handler SET immediately after importing this module; the
// incumbent we now wrap must not remain in it, or Next would call it RAW.
evictWrappedBackendFromHandlerSet(backend);

export default handler;
