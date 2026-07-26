# Plan — resolve B1-lite's edge-invalidation conflict, then continue the retirement plan

**Created:** 2026-07-26 · **Decision recorded:** 2026-07-26 · **Parent plan:** `docs/architecture/workaround-retirement-plan.md` (rev 23)

## The conflict

`workaround-retirement-plan.md` §B1 specifies that B1-lite must "invoke the existing
best-effort scheduled Cloudflare purge" and be tested so that "successful mutations attempt
**both** Next and edge invalidation".

That is no longer achievable as written. `lib/cloudflare-purge.ts` reads
`getCloudflareApiToken`, so it is a **credential authority**. The event-pipeline boundary gate
(`apps/web/tools/events/verify-event-pipeline-boundaries.live.test.ts`, introduced by #3142 on
2026-07-23 — i.e. **after** plan rev 22) fails any *new* API route whose import graph reaches
`env.ts` through a secret-reading module. Existing routes' edges are inherited from the frozen
baseline; a brand-new route's are not.

Escape hatches that do **not** work:

- A dynamic `import()` — `event-pipeline-static-module-graph.ts` follows `ImportKeyword` call
  expressions as well as static imports (verified by reading the analyzer).
- Importing `@/lib/cache-revalidation` instead — that module imports `cloudflare-purge` itself,
  so any of its exports drags the same edge in. (This is why `revalidateCategories` was extracted
  into the lean `lib/revalidate-categories.ts`.)

## Decision

**Ship B1-lite with origin-authoritative tag revalidation only. Do not restore the in-handler
purge, and do not widen the credential allowlist.**

Rationale:

1. Cache invalidation is a consequence of the write, not a job of the request handler. The
   correct shape is the transactional outbox already specified as **B0 → B1-durable**: mutation
   and invalidation intent commit together, and one privileged drainer holds the credential.
2. The security gate is the architecture surfacing a misplaced call, not an obstacle. A
   fire-and-forget `after()` purge from a merchant-facing handler is precisely the "band-aid in
   app code standing in for the real boundary" this plan exists to delete.
3. Widening `manifest.authority.*` to let a category route hold a CDN credential grows blast
   radius for convenience — the anti-pattern.
4. The parent plan already points this way: **rev 17** states the durable substrate is shared by
   B1/B2 and that "B1 can no longer terminate in a lossy post-commit purge". The best-effort
   purge is a waypoint, not the destination.

**Honest limit of that argument:** rev 17 establishes the purge is not the *destination*; it does
not by itself authorise dropping it from B1-lite. This is a genuine amendment to B1-lite's
acceptance criteria and must be written into the plan, not quietly missed.

## Measured exposure while the gap is open

Category documents are served `s-maxage=300, stale-while-revalidate=86400`
(`apps/web/src/proxy.ts:4590`); the Next `categories` profile is
`stale 300 / revalidate 3600 / expire 86400` (`next.config.ts:175`).

After a category mutation the origin is immediately correct (tags are revalidated). The CDN
therefore serves stale for at most `s-maxage` (300s), then one stale response per PoP while SWR
refetches from the already-correct origin. **Not** 24h — that figure is the SWR window, not the
staleness window. Bounded and self-healing.

## Steps

1. **Amend the parent plan (rev 23).** In §B1, replace the B1-lite edge-purge clause with:
   Next tag revalidation only; edge invalidation deferred to B1-durable because a new
   merchant-facing route may not hold a CDN credential under the #3142 boundary gate. Update the
   B1-lite test obligation from "attempt both Next and edge invalidation" to "attempt Next
   invalidation, and assert the module holds no credential-reaching import". Record the measured
   staleness budget above.
2. **Record it in #3207** (`docs/b1-lite-status`), which already documents B1-lite status. It
   must not claim edge invalidation shipped.
3. **Land #3205.** See the handover doc for its outstanding review findings.
4. **Then Workstream D** — #3199, #3203, #3201 — per the parent plan's execution order.
5. **Then prioritise B0** (durable invalidation substrate ADR + runtime selection). B0 is the
   real unblock for edge freshness; it is also the prerequisite for B1-durable and B2.

## Non-goals

- Do **not** expand `manifest.authority.serviceImporters` / `adminImporters` /
  `trustedWrapperImporters` to make the purge work.
- Do **not** rotate `FROZEN_EVENT_PIPELINE_*` baselines for this. That is the two-commit dance
  (see `reference_event_pipeline_boundary_manifest_regen`) and would leave `main` red between
  the two PRs.
- Do **not** call `/api/cache/revalidate` from the category handler. The parent plan explicitly
  forbids granting `settings:edit` merely to make a purge run.

---

## DECISION DELEGATED — research and decide, do not escalate

The repo owner has delegated this decision to the next agent. **Make the call yourself, record
it here with evidence, and proceed.** Do not hand it back for a ruling.

The "Decision" section above is a *recommendation from the previous agent*, not a constraint.
Reverse it if the evidence says otherwise — that is the expected outcome if any check below fails.

### Verify before you decide (do not inherit these claims)

1. **The gate actually blocks it.** Re-add the `cloudflare-purge` import to
   `lib/category-cache-invalidation.ts` on a scratch commit and run
   `verify-event-pipeline-boundaries.live.test.ts`. Confirm it fails, and read
   `event-pipeline-service-authority-graph.ts` + `event-pipeline-static-module-graph.ts` to
   confirm dynamic `import()` is followed. (Previous agent verified both; re-confirm cheaply.)
2. **The staleness math.** `proxy.ts:4590` gives `s-maxage=300, stale-while-revalidate=86400`,
   but there are two branches (`:4560` uses 7200/172800) — determine which applies to category
   documents on `ogabassey.com`, and check the **Cloudflare dashboard cache rule** for that
   hostname, which can override origin directives. If real-world staleness is hours rather than
   ~5 minutes, the recommendation is much weaker.
3. **Is there an already-allowlisted surface that may legitimately purge?** The previous agent
   did *not* exhaustively check this. Candidates: existing cron/drainer routes, or
   `storefront-publication-cache-eviction.ts` consumers. If one exists whose edges are already
   in the frozen baseline and whose authorization model fits category mutations, that is a
   better answer than either shipping without the purge or widening the allowlist. Note the
   plan forbids routing this through `/api/cache/revalidate` (it requires `settings:edit`).
4. **How far away is B0?** If the durable substrate is weeks out, the gap is long-lived and the
   case for an interim mechanism strengthens. If it is next in the queue, waiting is cheap.
5. **How often do category mutations actually happen?** Rare edits make a bounded stale window
   close to irrelevant; frequent ones do not.

### Decision criteria

Ship without the edge purge (recommended) **unless** (2) shows a materially longer staleness
window than ~5 minutes, **or** (3) finds a legitimate already-allowlisted purge path. Widening
`manifest.authority.*` remains the last resort and requires owner/security review — if you
conclude that is genuinely the right answer, stop and say so rather than doing it unilaterally.

### After deciding

- Amend `workaround-retirement-plan.md` to rev 23 per step 1 above so plan and code agree.
- Update #3207 so it does not claim edge invalidation shipped.
- Append your decision, the evidence, and the date to this file.
- Continue the execution order in `retirement-plan-execution-handover.md`.

---

## Delegated decision — 2026-07-26

**Decision: ship B1-lite with Next tag revalidation only. Do not add a Cloudflare purge and do
not widen `manifest.authority.*`.** PR #3205 merged as `5e09cafc335f84fd4b54fbefe64f1497a660f01d`.

Evidence checked rather than inherited:

1. The repository authority graph follows both static and dynamic imports. A category mutation
   path reaching `cloudflare-purge.ts` therefore reaches `env.ts` credential authority and is
   rejected for a new merchant route. PR #3205's repository tests assert that this edge is absent.
2. The category-document branch is the 300/86400 branch, not the 7200/172800 branch. More
   importantly, live `ogabassey.com` responses reported Cloudflare `DYNAMIC`; browser requests
   reported Vercel `HIT`, while Googlebot reported Vercel `BYPASS`. The live Cloudflare layer is
   not retaining the category document that the proposed purge would target.
3. No legitimate already-allowlisted replacement was found. `/api/cache/revalidate` requires
   `settings:edit` and cannot inherit category owner-only authority;
   `storefront-publication-cache-eviction.ts` is publication-scoped; and the repository has no
   category-capable durable cron/drainer today.
4. B0 is already the next architectural cache step after the D cleanup queue. It is the correct
   home for one privileged, retryable drainer rather than a new fire-and-forget credential edge.
5. Category mutation volume is low enough that this interim behavior does not falsify the
   decision: the in-repo create path is sparse, while out-of-band edits must move onto the API
   regardless of purge mechanism.

Result: neither falsifier occurred. Staleness was not shown to be materially worse than the
roughly five-minute origin directive, and no authorization-compatible allowlisted purge path
exists. The parent plan is amended to rev 23; durable Cloudflare acknowledgement remains
B0 → B1-durable work.
