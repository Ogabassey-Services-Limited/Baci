# Plan — resolve B1-lite's edge-invalidation conflict, then continue the retirement plan

**Created:** 2026-07-26 · **Decision corrected:** 2026-07-26 · **Parent plan:** `docs/architecture/workaround-retirement-plan.md` (rev 26)

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

## Superseded recommendation

The previous recommendation was to ship B1-lite with origin-authoritative tag revalidation only.
The delegated decision below supersedes it after exact-head review corrected the SWR exposure.

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

Canonical custom-domain category documents use the layered storefront-document headers, not the
nested-listing branch at `proxy.ts:4590`: Vercel receives
`max-age=300, stale-while-revalidate=86400`, while downstream Cloudflare receives
`max-age=3600, stale-while-revalidate=86400, stale-if-error=86400`
(`config/storefront-cdn-cache-control.ts`). The Next `categories` profile is
`stale 300 / revalidate 3600 / expire 86400` (`next.config.ts:175`).

When tag revalidation succeeds, the origin is immediately correct, but a retained Vercel object
may still be served during its full `300 + 86400` allowance. Tag revalidation can also fail after
the database commit; the route deliberately returns success with `cache.revalidated: false` in
that case. Then the origin falls back to the Next profile's natural revalidation/expiry window
(up to its 86,400-second expiry), and an edge revalidation can refill from stale origin data.
Cloudflare was `DYNAMIC` in the live probe, but Vercel was `HIT`, so the Vercel window is active;
the downstream Cloudflare directive remains part of the contract and a dashboard rule may override
the observed behavior. There is no defensible five-minute upper bound.

## Steps

1. **Amend the parent plan (rev 26).** Record PR #3205 as the mutation-boundary foundation and
   #3207 as the authorization-compatible Vercel eviction follow-up. Keep Cloudflare credential
   authority out of the merchant handler and leave durable retries to B1-durable.
2. **Record it in #3207** (`docs/b1-lite-status`), which already documents B1-lite status. It
   must not claim edge invalidation shipped.
3. **Complete B1-lite in #3207.** Hard-expire the affected Next tags, then await deletion of the
   existing tenant-scoped Vercel response tags. Report failure without misreporting the committed
   database mutation.
4. **Prioritise B0** by completing the exit checklist in the adopted
   `docs/architecture/adr/B0-durable-cache-invalidation-substrate.md`, then B1-durable. Do not
   recreate the ADR or repeat runtime selection.
5. **Then Workstream D** — #3199, #3203, #3201 — after the edge-freshness bound is complete.

## Non-goals

- Do **not** expand `manifest.authority.serviceImporters` / `adminImporters` /
  `trustedWrapperImporters` to make the purge work.
- Do **not** rotate `FROZEN_EVENT_PIPELINE_*` baselines for this. The repository has no documented
  safe regeneration command for those frozen authority bytes; changing them ad hoc can leave
  `main` red and is outside this decision.
- Do **not** call `/api/cache/revalidate` from the category handler. The parent plan explicitly
  forbids granting `settings:edit` merely to make a purge run.

---

## Completed delegation record — do not repeat

The repo owner delegated this decision in writing, with authority to reverse the prior
recommendation. That investigation is complete and its corrected result is recorded below.
Subsequent executors should not repeat it unless cache behavior or authority boundaries change.

The superseded recommendation above was not a constraint. The delegated criteria required reversal
if staleness materially exceeded five minutes or a legitimate allowlisted purge surface existed.

### Checks completed

1. The authority graph follows static and dynamic imports, so the new merchant route cannot reach
   `cloudflare-purge.ts` without a new privileged edge.
2. The canonical category page uses layered Vercel/Cloudflare document headers; live Cloudflare
   was `DYNAMIC`, while Vercel was `HIT`. Full SWR and failed-origin-revalidation paths were counted.
3. The broad publication wrapper is authorization-incompatible, but its lower-level Vercel tag
   deletion primitive is compatible: it reaches `@vercel/functions`, not `env.ts` credentials.
4. The B0 ADR already selected the VPS cron/web-route runtime; its exit checklist is incomplete.
5. Mutation volume is low, but frequency does not bound the age of a retained response.

### Applied decision criteria

Both falsifiers fired: staleness exceeded five minutes and a legitimate allowlisted Vercel path
exists. B1-lite therefore uses that primitive. Widening `manifest.authority.*` remains unapproved
and was not performed.

## Delegated decision — 2026-07-26 (corrected after exact-head review)

**Decision: retain PR #3205 and complete B1-lite with immediate Next expiry followed by confirmed
deletion of the existing tenant-scoped Vercel response tags. Do not add an in-handler Cloudflare
credential and do not widen `manifest.authority.*`.** PR #3205 merged as
`5e09cafc335f84fd4b54fbefe64f1497a660f01d`; the Vercel follow-up is in #3207.

Evidence checked rather than inherited:

1. The repository authority graph follows both static and dynamic imports. A category mutation
   path reaching `cloudflare-purge.ts` therefore reaches `env.ts` credential authority and is
   rejected for a new merchant route. PR #3205's repository tests assert that this edge is absent.
2. Canonical category documents use the layered storefront-document headers: Vercel
   300/86400 and downstream Cloudflare 3600/86400/86400. Live `ogabassey.com` responses reported
   Cloudflare `DYNAMIC`, but browser requests reported Vercel `HIT`. The browser object may be
   served stale anywhere in the full SWR allowance, and failed tag revalidation leaves the origin
   on its natural Next cache window, so exposure can exceed five minutes by hours.
3. A legitimate already-allowlisted replacement was found. The full publication wrapper is
   unsuitable because it also reaches Cloudflare credentials, but
   `purgeVercelStorefrontPublicationCache` plus `buildStorefrontPublicationCacheTags` imports no
   `env.ts` credential authority and targets the exact `ps:`/`ph:` tags already carried by the
   active HTML layer. #3207 uses that path after hard-expiring the inner Next tags.
4. The adopted B0 ADR is the correct home for one privileged, retryable drainer rather than a new
   fire-and-forget credential edge. Complete its exit checklist instead of repeating runtime
   selection. Because the measured bound is materially worse than five minutes, move B0/B1-durable
   ahead of the unrelated D cleanup queue.
5. Category mutation volume appears low, but frequency does not bound the age of a retained
   response. Out-of-band edits must also move onto the API regardless of purge mechanism.

Result: both falsifiers occurred. The five-minute recommendation is withdrawn, and the compatible
Vercel primitive is used now rather than deferred. The parent plan is corrected to rev 26;
B0 → B1-durable remains next for transactional intent, retries, out-of-band writers, and strict
Cloudflare coverage. The B0 route's new service-role authority is explicitly blocked on separate
owner/security approval; no credential-blast-radius change is performed here.
