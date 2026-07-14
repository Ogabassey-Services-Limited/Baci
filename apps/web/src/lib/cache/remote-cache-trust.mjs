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
 * @typedef {'refresh_tags' | 'get_expiration' | 'update_tags' | 'dropped_update_tags'} CacheTrustReason
 *
 * @typedef {object} CacheTrustOptions
 * @property {number} distrustMs Backstop only — see above.
 * @property {() => number} [now]
 *
 * @typedef {object} CacheTrust
 * @property {() => boolean} isTrusted
 * @property {(reason: CacheTrustReason, ttlMs?: number) => void} degrade
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
 * 1 hour — the distrust TTL for a DROPPED INVALIDATION specifically.
 *
 * The 5s backstop above is sized for a transient READ-path blip, which the next
 * request re-probes away. A dropped bust is a different animal: the shared store
 * keeps the pre-mutation entry for its whole `cacheLife.revalidate` window, and
 * from `next.config.ts` those are:
 *
 *   | profile    | revalidate |
 *   |------------|------------|
 *   | merchant   | 60s        |
 *   | products   | 300s       |
 *   | categories | **3600s**  |  ← a FULL HOUR
 *
 * A 5s distrust would therefore have us cheerfully re-serving that stale entry
 * five seconds later. This TTL matches the worst-case window, so for as long as
 * the stale entry can exist, this instance reads from the origin instead.
 *
 * ⚠️ MITIGATION, NOT A CURE — and the distinction matters:
 *
 *  - it only stops THIS instance serving the stale entry. Other instances never
 *    saw the failed bust, carry no distrust, and will read the same stale entry
 *    straight out of the shared store;
 *  - it trades staleness for ORIGIN LOAD. The PR-4 census says the origin can
 *    absorb that (PDP: 0 of the remote sites on the happy path; category: 4;
 *    home: 8 — all bounded, indexed, sub-50ms reads), which is what makes this a
 *    legitimate trade rather than a reckless one.
 *
 * Only a durable outbox (persist the failed bust, retry until the shared store
 * confirms it) closes the cross-instance gap.
 */
export const DEFAULT_DROPPED_BUST_DISTRUST_MS = 3_600_000;

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

    /**
     * `ttlMs` overrides the default backstop. It exists for the CIRCUIT-OPEN
     * case: while a leg's circuit is open we are not probing that leg at all, so
     * the short "until the next successful retry" window is the wrong shape —
     * there will BE no retry until the cooldown elapses. Distrust must outlive
     * the circuit, or it lapses mid-outage and reads start fetching entries that
     * will be discarded anyway.
     */
    degrade(reason, ttlMs) {
      distrustedUntil.set(reason, now() + (ttlMs ?? distrustMs));
    },

    /** The leg recovered — it no longer has anything to say about freshness. */
    restore(reason) {
      distrustedUntil.delete(reason);
    },
  };
}
