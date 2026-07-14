// @ts-check

/**
 * INVARIANT A — degrade toward the ORIGIN, never toward unverified data.
 *
 * The single chokepoint that gates EVERY cache read. If any part of the cache
 * subsystem is degraded, we cannot verify an entry's freshness, and an entry we
 * cannot verify must not be served: the read becomes a MISS and the route
 * recomputes from the origin. A slow correct page beats a fast wrong one.
 *
 * Why a latch rather than "just handle each failure where it happens": the
 * failure legs are not local to the read. `refreshTags()` failing means this
 * instance's tag manifest may be stale, so a LATER `get()` — which itself
 * succeeds — can hand back a pre-invalidation entry. Freshness is a property of
 * the subsystem, not of the individual call, so it needs subsystem-level state.
 *
 * Each degradation reason is tracked and expires independently, so the leg that
 * broke can clear its own distrust when it recovers, while a still-broken leg
 * keeps reads honest. Expiry is time-bounded so a leg that is never called again
 * cannot disable the cache forever.
 *
 * @typedef {'refresh_tags' | 'get_expiration'} CacheTrustReason
 *
 * @typedef {object} CacheTrustOptions
 * @property {number} distrustMs How long one degradation keeps reads honest.
 * @property {() => number} [now]
 *
 * @typedef {object} CacheTrust
 * @property {() => boolean} isTrusted
 * @property {(reason: CacheTrustReason) => void} degrade
 * @property {(reason: CacheTrustReason) => void} restore
 */

/**
 * @param {CacheTrustOptions} options
 * @returns {CacheTrust}
 */
export function createCacheTrust(options) {
  const { distrustMs } = options;
  const now = options.now ?? Date.now;

  /** Reason -> timestamp until which that reason keeps the cache untrusted. */
  /** @type {Map<CacheTrustReason, number>} */
  const distrustedUntil = new Map();

  return {
    isTrusted() {
      if (distrustedUntil.size === 0) return true;

      const current = now();
      for (const [reason, until] of distrustedUntil) {
        if (current < until) return false;
        // Bound the blast radius: a stale distrust must not linger forever.
        distrustedUntil.delete(reason);
      }
      return true;
    },

    degrade(reason) {
      distrustedUntil.set(reason, now() + distrustMs);
    },

    /** The leg recovered — it no longer has anything to say about freshness. */
    restore(reason) {
      distrustedUntil.delete(reason);
    },
  };
}
