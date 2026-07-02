# ChunkLoadError recovery problem statement — 2026-07-02

## Production symptom

PostHog still records low-volume `ChunkLoadError` events on OgaBassey storefront sessions after the runtime recovery patches in PRs 2809, 2816, and 2857. Recent examples include stale Next.js chunk URLs with `?dpl=` deployment identifiers on PDP and checkout routes.

## Why this matters

A stale JavaScript chunk after a deployment should self-heal with one safe reload per deployment/path. If recovery does not run, shoppers can remain on a broken route. If recovery suppresses errors when it will not reload, real runtime failures become invisible. If recovery reloads too aggressively, it can create loops and regress Core Web Vitals or checkout completion.

## Known attempted fixes

- PR 2809 hardened PostHog observability and runtime recovery.
- PR 2816 hardened chunk-load recovery deployment keys.
- PR 2857 adjusted runtime recovery while stabilizing blog shell work.

Despite those merges, PostHog still shows low-volume chunk failures, so the next agent should treat this as a verification problem first, not as permission to add more suppression.

## Required investigation

1. Pull the latest PostHog issue samples for all `ChunkLoadError` fingerprints and capture session ids, URLs, browser versions, chunk URLs, and deployment ids.
2. Confirm whether the recovery code sees the same deployment id used by the failed chunk URL and whether `shouldReloadForChunkError` returns true.
3. Reproduce locally with a stale chunk URL or controlled mocked runtime to prove whether the handler reloads exactly once per deployment/path.
4. Inspect whether `preventDefault()` / `stopImmediatePropagation()` only run when a reload is actually scheduled.
5. Decide whether remaining events are expected stale-client residue after deployment, a recovery-key bug, or a browser-specific event-shape miss.

## Constraints

- Do not hide errors without proving recovery runs.
- Do not add reload loops.
- Do not regress SEO, LCP, FCP, or checkout stability.
- Keep fixes deployment-id aware and covered by tests.
