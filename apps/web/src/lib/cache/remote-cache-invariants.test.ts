// @vitest-environment node
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';
import { createResilientRemoteCacheHandler } from './resilient-remote-cache-handler.mjs';

/**
 * THE TWO INVARIANTS (Codex round 2 — all five findings are consequences of
 * these, so they are enforced at one chokepoint each rather than patched
 * per-leg).
 *
 *   INVARIANT A — degrade toward the ORIGIN, never toward unverified data.
 *     If ANY part of the cache subsystem is degraded, a read MUST become a MISS.
 *     We never serve an entry whose freshness we cannot currently verify.
 *
 *   INVARIANT B — every backend interaction is time-bounded.
 *     No await on the backend may hang. Every call is raced with a timeout, and
 *     a timeout is a FAILURE (feeds the breaker), never an indefinite wait.
 *
 * These tests are parametrized over every degradation leg, so a newly added
 * degradation path cannot silently forget to opt in: adding a leg to the table
 * is the only way to describe it, and the table asserts the invariant for all.
 */

type CacheEntryLike = {
  value: ReadableStream<Uint8Array>;
  tags: string[];
  stale: number;
  timestamp: number;
  expire: number;
  revalidate: number;
};

const encoder = new TextEncoder();

function makeEntry(body = 'cached', timestamp = 1_000): CacheEntryLike {
  return {
    value: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
    tags: ['products-m1'],
    stale: 300,
    timestamp,
    expire: 86_400,
    revalidate: 300,
  };
}

/** A stream that yields some bytes then errors — the documented failure mode. */
function makeTruncatedEntry(): CacheEntryLike {
  return {
    ...makeEntry(),
    value: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('partial'));
        controller.error(new Error('connection reset mid-stream'));
      },
    }),
  };
}

/** Never settles — the hang, as opposed to the rejection. */
function hang<T>(): Promise<T> {
  return new Promise<T>(() => {});
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

function healthyBackend(): Backend {
  return {
    get: vi.fn<Backend['get']>().mockResolvedValue(undefined),
    set: vi.fn<Backend['set']>().mockResolvedValue(undefined),
    refreshTags: vi.fn<Backend['refreshTags']>().mockResolvedValue(undefined),
    getExpiration: vi.fn<Backend['getExpiration']>().mockResolvedValue(0),
    updateTags: vi.fn<Backend['updateTags']>().mockResolvedValue(undefined),
  };
}

const TIMEOUT_MS = 25;

function makeHandler(backend: Backend) {
  return createResilientRemoteCacheHandler({
    backend,
    logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    backendTimeoutMs: TIMEOUT_MS,
    failureThreshold: 3,
    cooldownMs: 30_000,
  });
}
describe('INVARIANT A — degrade toward the origin', () => {
  let unhandled: unknown[];
  let onUnhandled: (reason: unknown) => void;

  beforeEach(() => {
    unhandled = [];
    onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
  });

  async function flush() {
    for (let i = 0; i < 3; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  /*  INVARIANT A — every degraded leg forces a MISS                   */
  /* ================================================================ */

  /**
   * Each leg degrades a DIFFERENT part of the subsystem while the object read
   * itself would happily return an entry. Under Invariant A, none of them may
   * result in that entry being served.
   */
  const degradationLegs: {
    name: string;
    finding: string;
    degrade: (backend: Backend) => void;
    /** Drive the leg (e.g. call refreshTags) before the read. */
    provoke?: (handler: ReturnType<typeof makeHandler>) => Promise<unknown>;
  }[] = [
    {
      name: 'refreshTags() rejects',
      finding: 'PRRT_kwDOQZgfis6Qmv0o',
      degrade: (b) => b.refreshTags.mockRejectedValue(new Error('503')),
      provoke: (h) => h.refreshTags(),
    },
    {
      name: 'refreshTags() hangs',
      finding: 'PRRT_kwDOQZgfis6Qmv0o + Invariant B',
      degrade: (b) => b.refreshTags.mockImplementation(hang),
      provoke: (h) => h.refreshTags(),
    },
    {
      name: 'getExpiration() rejects',
      finding: 'PRRT_kwDOQZgfis6Qmv0r',
      degrade: (b) => b.getExpiration.mockRejectedValue(new Error('503')),
      provoke: (h) => h.getExpiration(['products-m1']),
    },
    {
      name: 'getExpiration() hangs',
      finding: 'PRRT_kwDOQZgfis6Qmv0r + Invariant B',
      degrade: (b) => b.getExpiration.mockImplementation(hang),
      provoke: (h) => h.getExpiration(['products-m1']),
    },
    {
      name: 'the entry stream errors mid-consumption',
      finding: 'PRRT_kwDOQZgfis6Qmv0s',
      degrade: (b) => b.get.mockResolvedValue(makeTruncatedEntry()),
    },
    {
      name: 'get() hangs',
      finding: 'Invariant B',
      degrade: (b) => b.get.mockImplementation(hang),
    },
    {
      name: 'get() rejects',
      finding: 'Invariant A',
      degrade: (b) => b.get.mockRejectedValue(new Error('502')),
    },
    {
      name: 'the entry stream STALLS mid-body',
      finding: 'PRRT_kwDOQZgfis6QnKUQ (Invariant B hole)',
      degrade: (b) => {
        b.get.mockImplementation(async () => ({
          value: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode('first chunk'));
              // ...and then nothing, ever. A stall, not an error.
            },
          }),
          tags: ['products-m1'],
          stale: 300,
          timestamp: 1_000,
          expire: 86_400,
          revalidate: 300,
        }));
      },
    },
    {
      name: 'updateTags() fails, dropping an invalidation',
      finding: 'PRRT_kwDOQZgfis6Qne4q',
      degrade: (b) => b.updateTags.mockRejectedValue(new Error('503')),
      // A dropped bust means the store still holds the PRE-MUTATION entry, and
      // nothing else will tell us. Reads must not stay confident.
      provoke: (h) => h.updateTags(['products-m1']),
    },
  ];

  describe.each(degradationLegs)('INVARIANT A: when $name ($finding)', ({
    degrade,
    provoke,
  }) => {
    it('the read becomes a MISS — never a possibly-stale or partial entry', async () => {
      const backend = healthyBackend();
      // The object read itself is perfectly happy to serve something.
      backend.get.mockImplementation(async () => makeEntry('possibly-stale'));
      degrade(backend);

      const handler = makeHandler(backend);
      if (provoke) await provoke(handler);

      await expect(
        handler.get('key-1', ['products-m1'])
      ).resolves.toBeUndefined();
    });

    it('raises no unhandled rejection', async () => {
      const backend = healthyBackend();
      backend.get.mockImplementation(async () => makeEntry());
      degrade(backend);

      const handler = makeHandler(backend);
      if (provoke) await provoke(handler);
      await handler.get('key-1', ['products-m1']);
      await flush();

      expect(unhandled).toEqual([]);
    });
  });

  it('a fully healthy subsystem still serves hits (the invariant must not be vacuous)', async () => {
    const backend = healthyBackend();
    backend.get.mockImplementation(async () => makeEntry('fresh'));
    const handler = makeHandler(backend);

    await handler.refreshTags();
    const entry = await handler.get('key-1', ['products-m1']);

    expect(entry).toBeDefined();
    await expect(new Response(entry?.value).text()).resolves.toBe('fresh');
  });

  /* ================================================================ */
});
