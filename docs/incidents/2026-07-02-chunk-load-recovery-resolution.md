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
- **Pinning is inert for the custom deployment id**: requests against
  production with `?dpl=`, `x-deployment-id`, and `__vdpl` for a verified
  previous in-window deployment id all returned the *current* deployment's
  HTML. This matches the open upstream bug class around prebuilt deploys with
  custom deployment ids (vercel/next.js#94734; Vercel support confirmed the
  edge "did not end up pinning the request" for that reporter). Requests for
  chunk filenames absent from the current deployment return 404 regardless of
  dpl.
- **~46% of failing chunk filenames are genuinely superseded** (404 today =
  hard deploy skew); ~54% are hash-stable across builds and still 200 —
  those failures were transient network errors (83.7% of events are mobile).
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
`stale-while-revalidate=3600`, by the edge HTML cache) × **Vercel skew
protection not pinning by the custom prebuilt deployment id** ⇒ stale
clients 404 on superseded chunk hashes. The client recovery mitigation then
missed the boundary-caught third of failures, missed resource-load failures,
failed closed without sessionStorage, and could not prove it ever ran.

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

- Watch vercel/next.js#94734; if Vercel fixes custom-id pinning for prebuilt
  deploys, the union becomes belt-and-braces rather than load-bearing.
  Consider raising `skewProtectionMaxAge` (now allowed up to deployment
  retention) once pinning demonstrably works.
- The union cache seed starts empty; full protection begins after ~48h of
  deploys have accumulated.
