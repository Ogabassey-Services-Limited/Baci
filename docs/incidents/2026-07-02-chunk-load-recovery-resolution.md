# ChunkLoadError recovery — root cause and permanent fix — 2026-07-02

Companion to [the problem statement](./2026-07-02-chunk-load-recovery-problem-statement.md).
This documents what the production evidence showed, why the previous patches
(PRs 2809, 2816, 2857) could not have eliminated the events, and what the
permanent fix changes.

## Evidence (PostHog production data, 30 days: 92 chunk `$exception` events)

- **58 of 92 events predate the recovery code entirely** (recovery first
  shipped 2026-06-27, PR 2809). The 2026-06-26 spike of 25 events is what
  motivated building recovery, not proof it failed. Post-recovery volume is
  ~7/day.
- **Skew ages**: resolving the `?dpl=` id embedded in every failed chunk URL
  to its GitHub deploy run, 76 of 77 resolvable events happened **within the
  12-hour Vercel Skew Protection window** (most 1–6h after their build).
  Skew protection (enabled, `skewProtectionMaxAge=43200`) rescued none of
  them.
- **Pinning behavior is split by surface.** Document requests are never
  pinned: `?dpl=`, `x-deployment-id`, and `__vdpl` for a verified previous
  in-window deployment id all return the *current* deployment's HTML.
  **Asset pinning by the custom id, however, was observed working**: right
  after a deploy, superseded chunk filenames requested with their own
  matching old dpl returned 200, while the same paths with the new dpl or no
  dpl returned 404 (the 200s carried `x-vercel-cache: HIT` with pre-deploy
  `age`, so origin-level routing vs edge-cache serving could not be fully
  separated). Note the adjacent open upstream bug class for prebuilt custom
  ids (vercel/next.js#94734) — pinning here is fragile, version-dependent,
  and unobservable when it fails.
- **404s under `/_next/static` are edge-cached with
  `cache-control: public, max-age=31536000, must-revalidate`** (verified
  twice, `x-vercel-cache: HIT` on the 404 itself). One mid-deploy race or
  propagation gap poisons that (path, dpl) for a whole PoP essentially
  permanently. This best explains the largest failure cohort: hash-stable
  chunk filenames (still 200 today from other vantage points) failing
  repeatedly for different sessions on working networks, all in-window with
  matching dpls.
- **~46% of failing chunk filenames are superseded and 404 today** (probed
  days later — consistent with expired retention and with era transitions in
  the dpl scheme: no-dpl → git-SHA → run-id formats all appear in-window);
  ~54% are hash-stable across builds and still 200 — transient mobile
  network failures plus the cached-404 mechanism above (83.7% of events are
  mobile).
- **31.5% of events were `mechanism.handled=true`** — caught by route
  `error.tsx` boundaries. In production, React 19 / Next 16 `onCaughtError`
  only calls `console.error`: no `window` error event, no unhandled
  rejection. The window-listener-based recovery **structurally cannot see
  these**.
- Raw resource-load failures (`<script>`/`<link>` 404s on initial HTML) fire
  a plain capture-phase `Event` with `error === undefined` and
  `message === undefined`; the old handler inspected only those two fields,
  so this shape was also invisible.
- The recovery emitted **no telemetry**, so "did the reload run?" was
  unanswerable from PostHog (a reload is indistinguishable from a manual
  refresh). Session tracing showed 2 clean recoveries, 3 ambiguous-silent in
  the post-recovery window.
- Non-suppression is intentional: PR 2857 deliberately removed
  `preventDefault()`/`stopImmediatePropagation()` after review flagged that
  they silently swallowed repeat failures. **Residual PostHog events are
  expected whenever recovery reloads** — the event is captured, then the
  page reloads.

## Root cause

High deploy cadence (~10 production deploys/day) × stale HTML held by
long-lived mobile tabs (and, for up to `s-maxage=300` +
`stale-while-revalidate=3600`, by the edge HTML cache) × a fragile chunk
availability chain: skew-protection pinning that is unobservable when it
fails and capped at 12h, year-cacheable edge 404s that turn one deploy-race
miss into persistent per-PoP breakage, dpl-scheme transitions, and flaky
mobile networks ⇒ stale (and sometimes current) clients 404 on chunk
fetches. The client recovery mitigation then missed the boundary-caught
third of failures, missed resource-load failures, failed closed without
sessionStorage, and could not prove it ever ran.

## Permanent fix (this change)

1. **Chunk-availability union (prevention, CI-level).**
   `.github/scripts/merge-static-union.sh` + deploy workflow steps carry the
   previous ~48h of `_next/static` files into every deployment (add-only;
   the current build's files always win; pruned by age and size cap).
   Stale in-window clients now find their chunks by filename, independent of
   Vercel edge routing. Zero runtime cost; no CWV impact.
2. **Complete detection (recovery-level).** The window `error` listener now
   also recognizes failing `<script>`/`<link rel="stylesheet">` Next assets
   via `event.target`; the message patterns additionally cover webpack CSS
   chunks and native ESM import failures.
3. **Boundary-caught failures recover.** All six route `error.tsx`
   boundaries hand their error to recovery through
   `useBoundaryErrorReport` → `useChunkLoadRecoveryBoundary`. While a
   recovery reload is pending they render a minimal inline-styled
   "Updating…" notice (inline styles on purpose — CSS chunks may be part of
   the outage). The exception is **still captured** to PostHog, now tagged
   `recovery_action: 'reload-scheduled' | 'none'`.
4. **Loop-safe fail-open guard.** One reload per
   `(deploymentId, pathname)` via sessionStorage, with a `window.name`
   fallback when storage is unavailable (private browsing / webviews), a
   3-reload session cap, and an offline check (reloading an offline tab
   would replace the app with the browser error page).
5. **Recovery telemetry.** Every decision — reload or declined (with
   reason) — emits a `chunk_load_recovery` event straight to the PostHog
   ingest proxy via `sendBeacon` (not via posthog-js, whose lazy chunk may
   itself be unloadable), carrying the page deployment id, the failed asset
   URL and its dpl, and whether they match. Recovery is now provable, per
   the incident constraint "do not hide errors without proving recovery
   runs".

Suppression remains absent by design: `preventDefault`/
`stopImmediatePropagation` are never called.

## How to verify in production (PostHog HogQL)

Recovery firing rate and outcomes:

```sql
SELECT properties.recovery_action AS action,
       properties.trigger_source AS source, count() AS n
FROM events
WHERE event = 'chunk_load_recovery' AND timestamp > now() - INTERVAL 7 DAY
GROUP BY action, source ORDER BY n DESC
```

Deployment-id mismatch check (problem-statement question 2 — does recovery
see the same deployment id as the failed chunk URL):

```sql
SELECT properties.deployment_id_match AS match, count() AS n
FROM events
WHERE event = 'chunk_load_recovery' AND timestamp > now() - INTERVAL 7 DAY
GROUP BY match
```

Residual `$exception` chunk events split into "recovery ran" vs "miss":

```sql
SELECT JSONExtractBool(JSONExtractArrayRaw(assumeNotNull(properties.$exception_list))[1],
         'mechanism', 'handled') AS handled,
       properties.recovery_action AS boundary_recovery, count() AS n
FROM events
WHERE event = '$exception'
  AND properties.$exception_types LIKE '%ChunkLoadError%'
  AND timestamp > now() - INTERVAL 7 DAY
GROUP BY handled, boundary_recovery
```

Expected steady state after the union ships: chunk `$exception` events drop
to transient-network residue; every remaining event pairs with a
`chunk_load_recovery` event; sessions recover (same-path `$pageview` within
seconds) or the event says why not.

## Follow-ups (not in this change)

- **Raise the year-cacheable `/_next/static` 404s with Vercel support.**
  A 404 for a chunk cached with `max-age=31536000` at the edge converts one
  deploy-window race into persistent per-PoP breakage; the union removes the
  skew-driven cause but cannot purge an already-poisoned edge entry. The new
  `chunk_load_recovery` telemetry (`deployment_id_match: true` + repeat
  errors on the same asset after reload) will quantify how often this
  happens.
- Watch vercel/next.js#94734 and Vercel's prebuilt custom-id pinning;
  consider raising `skewProtectionMaxAge` (now allowed up to deployment
  retention) once pinning is demonstrably reliable end-to-end.
- The union cache seed starts empty; full protection begins after ~48h of
  deploys have accumulated.
