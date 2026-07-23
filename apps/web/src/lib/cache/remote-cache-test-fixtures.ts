import { type Mock, vi } from 'vitest';

/**
 * Shared fixtures for the remote-cache handler suites.
 *
 * Test-only infrastructure: the handler suites were split along describe
 * boundaries to respect the 300-line cap, and they all need the same fake
 * backend and entry factory.
 */

/** Mirrors Next 16's `CacheEntry` (server/lib/cache-handlers/types.d.ts). */
export type CacheEntryLike = {
  value: ReadableStream<Uint8Array>;
  tags: string[];
  stale: number;
  timestamp: number;
  expire: number;
  revalidate: number;
};

export type FakeBackend = {
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

export type FakeLogger = {
  log: Mock<(message: string) => void>;
  warn: Mock<(message: string) => void>;
  error: Mock<(message: string) => void>;
};

/** Shared encoder for tests that build their own streams. */
export const encoder = new TextEncoder();

/**
 * A cache entry with a FRESH stream every call. A `ReadableStream` is single
 * use, so `mockResolvedValue(makeEntry())` — which reuses one object — breaks as
 * soon as the entry is read twice.
 */
export function makeEntry(
  body = 'cached-payload',
  tags: string[] = ['products-m1'],
  timestamp = 1_000
): CacheEntryLike {
  return {
    value: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
    tags,
    stale: 300,
    timestamp,
    expire: 86_400,
    revalidate: 300,
  };
}

export function makeBackend(overrides: Partial<FakeBackend> = {}): FakeBackend {
  return {
    get: vi.fn<FakeBackend['get']>().mockResolvedValue(undefined),
    set: vi.fn<FakeBackend['set']>().mockResolvedValue(undefined),
    refreshTags: vi
      .fn<FakeBackend['refreshTags']>()
      .mockResolvedValue(undefined),
    getExpiration: vi.fn<FakeBackend['getExpiration']>().mockResolvedValue(0),
    updateTags: vi.fn<FakeBackend['updateTags']>().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function makeLogger(): FakeLogger {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
}
