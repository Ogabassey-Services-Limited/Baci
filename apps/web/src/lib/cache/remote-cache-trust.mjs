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
 * broke clears its own distrust the moment it recovers, while a still-broken leg
 * keeps reads honest.
 *
 * ## Blast radius — deliberately bounded on three axes
 *
 * 1. **Kind.** This trust state belongs to the `'remote'` cache handler ONLY.
 *    Next resolves handlers per kind (`getCacheHandler(kind)`), and plain
 *    `'use cache'` (kind `'default'`) is served by a DIFFERENT handler instance
 *    that we neither wrap nor gate. So distrust can never disable the local
 *    caches — only the shared-store sites.
 *
 * 2. **Time.** `distrustMs` is a BACKSTOP, not the expected recovery path.
 *    Next calls `refreshTags()` at the start of every request ("always before
 *    starting a new request"), so under any real traffic the very next request
 *    re-probes the failed leg and `restore()` clears the distrust immediately.
 *    The timer only covers the pathological case where the leg is never retried
 *    (an idle instance, or the read circuit skipping it) — hence a SHORT default
 *    rather than a long blind cooldown. A cache blip must not become a sustained
 *    origin read storm (the feedback loop in plan §4.1 is what we are avoiding).
 *
 * 3. **Reason.** A recovered leg stops contributing distrust even while another
 *    leg is still broken.
 *
 * @typedef {'refresh_tags' | 'get_expiration'} CacheTrustReason
 *
 * @typedef {object} CacheTrustOptions
 * @property {number} distrustMs Backstop only — see above.
 * @property {() => number} [now]
 *
 * @typedef {object} CacheTrust
 * @property {() => boolean} isTrusted
 * @property {(reason: CacheTrustReason) => void} degrade
 * @property {(reason: CacheTrustReason) => void} restore
 */

/**
 * 5 seconds.
 *
 * This is a BACKSTOP, not the recovery mechanism — recovery is `restore()` on
 * the failed leg's next success, which under traffic happens on the very next
 * request (Next re-invokes `refreshTags()` before each one). The window only has
 * to bridge the gap until that retry.
 *
 * It is deliberately far shorter than the breaker cooldown (30s) and decoupled
 * from it: the breaker is protecting a SICK BACKEND from load, whereas distrust
 * is protecting CORRECTNESS, and it pushes load onto the ORIGIN. Those want
 * opposite dials. A long distrust window would turn a momentary tags-service
 * blip into a sustained full-origin read storm — precisely the Supabase-pooler
 * feedback loop this plan exists to break (§4.1).
 */
export const DEFAULT_DISTRUST_MS = 5_000;

/**
 * @param {CacheTrustOptions} options
 * @returns {CacheTrust}
 */
export function createCacheTrust(options) {
  const distrustMs = options.distrustMs ?? DEFAULT_DISTRUST_MS;
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
