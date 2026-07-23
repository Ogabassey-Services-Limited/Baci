import { vi } from 'vitest';

/**
 * Shared replay machinery for the remote-cache failure harnesses.
 *
 * `renderRouteThroughCache` mirrors `use-cache-wrapper.js` (~1277-1320) exactly:
 * refreshTags is awaited BEFORE get(); getExpiration is awaited AFTER it and only
 * when an entry exists; the entry is then discarded when
 * `entry.timestamp <= implicitTagsExpiration` (shouldDiscardCacheEntry:1532); and
 * the set() promise is pushed onto `pendingRevalidateWrites` and awaited only
 * AFTER the response — the window in which a rejected write kills the process.
 */
export type CacheEntry = {
  value: ReadableStream<Uint8Array>;
  tags: string[];
  stale: number;
  timestamp: number;
  expire: number;
  revalidate: number;
};

export type CacheHandlerLike = {
  get: (key: string, softTags: string[]) => Promise<CacheEntry | undefined>;
  set: (key: string, pending: Promise<CacheEntry>) => Promise<void>;
  refreshTags: () => Promise<void>;
  getExpiration: (tags: string[]) => Promise<number>;
  updateTags: (
    tags: string[],
    durations?: { expire?: number }
  ) => Promise<void>;
};

/** The product a found route must keep returning even with a dead cache. */
export const PRODUCT = {
  slug: 'iphone-15-pro-max',
  name: 'iPhone 15 Pro Max',
  price: 1_850_000,
  inStock: true,
};

export const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeEntry(payload: unknown, tags: string[]): CacheEntry {
  const body = encoder.encode(JSON.stringify(payload));
  return {
    value: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(body);
        controller.close();
      },
    }),
    tags,
    stale: 300,
    timestamp: Date.now(),
    expire: 86_400,
    revalidate: 300,
  };
}

async function decodeEntry(entry: CacheEntry): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  const reader = entry.value.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(decoder.decode(merged));
}

/**
 * A faithful stand-in for the `'use cache: remote'` wrapper: consult the
 * handler, render on a miss, and hand the write to the handler WITHOUT awaiting
 * it inside the request (exactly what Next does).
 */
export async function renderRouteThroughCache(
  handler: CacheHandlerLike,
  cacheKey: string,
  tags: string[],
  loader: () => Promise<typeof PRODUCT | null>,
  pendingRevalidateWrites: Promise<void>[]
): Promise<{ status: number; body: typeof PRODUCT | null }> {
  // Order and discard logic mirror `use-cache-wrapper.js` (~1277-1320) exactly:
  // refreshTags is awaited BEFORE get(); getExpiration is awaited AFTER it and
  // only when an entry exists; and the entry is then discarded when
  // `entry.timestamp <= implicitTagsExpiration` (shouldDiscardCacheEntry:1532).
  await handler.refreshTags();

  let hit = await handler.get(cacheKey, tags);

  if (hit) {
    let implicitTagsExpiration = 0;
    const expiration = await handler.getExpiration(tags);
    if (expiration < Number.POSITIVE_INFINITY) {
      implicitTagsExpiration = expiration;
    }
    if (hit.timestamp <= implicitTagsExpiration) {
      hit = undefined;
    }
  }

  if (hit) {
    return { status: 200, body: (await decodeEntry(hit)) as typeof PRODUCT };
  }

  const data = await loader();
  // A genuine "not found" is the ONLY thing allowed to 404.
  if (data === null) {
    return { status: 404, body: null };
  }

  const pendingEntry = Promise.resolve(encodeEntry(data, tags));
  // Fire-and-forget, exactly like `workStore.pendingRevalidateWrites.push(...)`.
  pendingRevalidateWrites.push(handler.set(cacheKey, pendingEntry));

  return { status: 200, body: data };
}

/** Let Node's microtask + macrotask queues drain so unhandledRejection can fire. */
export async function flushEventLoop() {
  for (let i = 0; i < 3; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

export function makeHostileBackend(error: Error): CacheHandlerLike {
  return {
    get: vi.fn().mockRejectedValue(error),
    set: vi.fn().mockRejectedValue(error),
    refreshTags: vi.fn().mockRejectedValue(error),
    getExpiration: vi.fn().mockRejectedValue(error),
    updateTags: vi.fn().mockRejectedValue(error),
  };
}
