// @ts-check

/**
 * Shared JSDoc types mirroring Next 16's cache-handler contract.
 *
 * Source of truth: `next/dist/server/lib/cache-handlers/types.d.ts` (Next
 * 16.2.9). These are re-declared rather than imported because this module tree
 * is loaded by Node directly — it is never bundled, so it cannot resolve
 * `next/...` type-only imports at runtime. Keep in sync when Next is upgraded.
 *
 * @typedef {number} Timestamp Milliseconds since the epoch.
 *
 * @typedef {object} CacheEntry
 * @property {ReadableStream<Uint8Array>} value Single-use; may error with partial data.
 * @property {string[]} tags Entry tags, excluding soft tags.
 * @property {number} stale Client-facing staleness [seconds].
 * @property {Timestamp} timestamp When the entry was created.
 * @property {number} expire How long the entry may be used [seconds].
 * @property {number} revalidate How long until revalidation is due [seconds].
 *
 * @typedef {object} CacheHandler
 * @property {(cacheKey: string, softTags: string[]) => Promise<CacheEntry | undefined>} get
 * @property {(cacheKey: string, pendingEntry: Promise<CacheEntry>) => Promise<void>} set
 * @property {() => Promise<void>} refreshTags
 * @property {(tags: string[]) => Promise<Timestamp>} getExpiration
 * @property {(tags: string[], durations?: { expire?: number }) => Promise<void>} updateTags
 */

export {};
