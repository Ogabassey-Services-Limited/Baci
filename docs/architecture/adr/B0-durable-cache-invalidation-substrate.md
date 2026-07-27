# ADR B0 — Durable cache-invalidation substrate & drainer runtime

**Status:** proposed (design adopted 2026-07-11; exit checklist incomplete) · **Owner/security sign-off required for:** the new service-role/credential-bearing cron route and boundary-manifest change, the VPS deploy step (crontab + `deploy.sh`), and the drain-latency SLA.
**Context source:** `docs/architecture/discovery/B0-drainer-runtime-brief.md`. **Revalidated vs** `origin/main@6758e4db3f`.

## Context

Raising Cloudflare/Vercel cache TTLs (the cost + LCP win in Workstream B2) is only safe if cache invalidation is *durable* — a dropped purge under a 1-hour TTL serves up to an hour of stale/removed content. Today `schedulePurgeCloudflareUrls` (`cache-revalidation.ts:61`) is fire-and-forget (`after()` / detached `void`), so purges can be silently lost. B0 selects and proves the durable substrate before any queue code, migration, or TTL change.

A durable system = a **claim-based outbox ledger** (Postgres) + a **drainer runtime** that scans it and performs ordered Next, Vercel, and Cloudflare invalidation. The repo already has the ledger *pattern* (`payment_side_effects`) but **no drainer runtime**.

## Decision

### D1 — Runtime: VPS cron sweep → a `CRON_SECRET`-gated web route (incumbent option c)

Adopt the existing VPS worker as the durable scheduler. Add **one** `CRON_SECRET`-gated route `POST /api/cron/drain-invalidations`, driven by the VPS `run-web-cron.mjs` on a `flock`-guarded crontab line — the same shape already used for ~15 jobs (`cleanup-orders`, `process-settlements`, `agentic-commerce-health`, …).

**Why the drainer is a web route and NOT a direct-Supabase `.mjs` job (hard constraint, resolves the brief's open Q2):** delivery must invalidate the Next Data Cache first (`revalidateTag`/`revalidatePath`, imported from `next/cache` in `cache-revalidation.ts:13`), then delete affected Vercel CDN tags before purging Cloudflare. A standalone `.mjs` VPS job cannot run the Next APIs, so an outer-edge purge could refill from stale inner data. The drainer therefore runs *in the Next runtime*, invoked by the VPS.

**Rejected:**
- **Vercel Cron** — reverses the documented decision (`docs/ops/vps-workers.md`: "Do not re-enable Vercel Cron…"), bills per invocation (Vercel cost is a tracked concern), 1-minute latency floor, no overlap guarantee. Keep only a manual/fallback `GET` on the route, never the primary schedule.
- **`pg_cron` + `pg_net` watchdog** — would be the project's *first committed* `cron.schedule()` (migration-drift risk; the repo has "recorded ≠ applied" scars), and `net.http_post` is fire-and-forget (no delivery guarantee, weak failure paging). Default **no**; revisit only if an independent drain-liveness watchdog is ever wanted.

### D2 — Latency: transactional outbox + best-effort immediate web drain + durable VPS sweep (no new listener)

Refinement of the brief's option-c lean: a cache purge is short and web-executable, so **no `baci-*-trigger` signed-listener is needed** (those exist for import jobs that spawn long VPS processes). Design:
1. Each covered mutation writes an **outbox row in the SAME DB transaction** as the mutation (transactional → cannot be lost; a post-commit `after()` enqueue would be lossy).
2. The web request may fire a **best-effort immediate drain** of its own row right after commit (keeps today's seconds-level latency on the happy path).
3. The **VPS cron sweep (every 2 min)** drains any row not `completed` — the durability guarantee that catches drops.

Merchant-facing freshness: happy path ≈ today (seconds); worst case (web-side drop) ≤ the sweep interval. If a tighter *guaranteed* floor is later required, the signed-trigger leg can be added without redesign. **Drain-latency SLA to confirm with owner: 2-minute sweep (proposed default).**

### D3 — Ledger schema (generalize `payment_side_effects`, keep the claim/lease core)

New table `public.cache_invalidation_outbox`, one row per invalidation target, generation-aware so a new mutation of an already-completed target re-queues (B2a's "never let a completed purge suppress a later mutation"):

| column | purpose |
|---|---|
| `merchant_id uuid` + `target_kind text` + `target_id text` | **PK** = one concrete invalidation target (`target_kind` ∈ product_cache / category_listing / storefront_document / sitemap / merchant_feed …; `target_id` = the exact tag/path/URL key). `merchant_id` is the immutable tenant/tombstone key. A rename/domain move enqueues separate old and new targets, so later coalescing cannot discard an earlier stale path. |
| `merchant_ref uuid` | Insert-time FK to `merchants(id)` with `ON DELETE SET NULL` and a check that a non-null ref equals `merchant_id`. It rejects invalid merchant IDs while preserving the immutable tenant key and queued storefront/sitemap/feed purge work after merchant deletion. |
| `generation bigint` | bumped on every enqueue; the "latest mutation" marker |
| `status text` (`pending`/`claimed`/`completed`/`failed`/`dead_letter`) | drain state; `dead_letter` is excluded from claims and requires operator action |
| `claim_token uuid`, `claimed_generation bigint`, `claimed_by text`, `claimed_at timestamptz` | lease |
| `completed_generation bigint`, `completed_at`, `attempts int`, `next_attempt_at timestamptz`, `last_error text` | terminal/retry state and the earliest time a failed row may be reclaimed |
| `payload jsonb` | delivery metadata for this concrete target; never the sole storage for additional stale paths |

- **Open-work index:** `... (status, next_attempt_at, claimed_at) WHERE status NOT IN ('completed','dead_letter')` — the drainer's queue query.
- **Enqueue** (in-mutation): `INSERT … generation=1, status='pending' ON CONFLICT (merchant_id,target_kind,target_id) DO UPDATE SET generation = outbox.generation + 1, status = 'pending', attempts = 0, payload = EXCLUDED.payload` — re-queues even a completed/dead-letter row. Enqueue one row per concrete target (for A→B→C, retain A, B, and C target rows). The helper is `SECURITY DEFINER` but ungranted to client roles and is invoked only by trusted definer mutation RPCs/triggers; it must not reject an outer authenticated JWT by checking `auth.role()`.
- **Claim** (`SECURITY DEFINER`, `service_role`-only + null-safe `auth.role() IS DISTINCT FROM 'service_role'` guard, mirroring `claim_payment_side_effect`): take a `pending`, due `failed` (`next_attempt_at <= now()`), or stale-`claimed` (> lease) row only while `attempts < max_attempts`, set `claimed_generation = generation`, `status='claimed'`, `claim_token`, `claimed_at=now()`, `attempts += 1`; return `we_won`. If a worker crashes on the threshold attempt, the next claim call parks the expired lease as `dead_letter` instead of leaving it stranded as `claimed`.
- **Complete:** `UPDATE … SET status='completed', completed_generation=claimed_generation WHERE claim_token=? AND generation = claimed_generation` — **if `generation` advanced during the drain, the row is NOT marked complete and re-drains** (generation-aware idempotency). Re-purging a tag/URL is idempotent, so a mid-lease crash after purging but before completing is harmless.
- **Fail:** a service-role-only, null-safe `fail_cache_invalidation` transition requires the matching claim token and generation, records `last_error`, and moves the row to `failed` with `next_attempt_at = now() + retry_delay` or `dead_letter` once `attempts >= max_attempts`. The drainer passes `max(parsed Retry-After, exponential backoff + jitter)` for provider throttles; ordinary retryable errors use the bounded default delay, so one loop cannot burn the retry budget immediately.
- **Lease and deadlines:** replace the unproven 30-second lease with a prototype-derived bound for
  all three stages. Provider calls need bounded per-stage deadlines; the lease must exceed the
  demonstrated worst-case full attempt with headroom, or be token-checked and renewed before each
  serial Vercel/Cloudflare batch. Include a delayed-Vercel case so a live worker cannot be reclaimed,
  consume extra attempts, or dead-letter work while its provider call is still active.
- **ACL:** RLS enabled; `REVOKE ALL FROM PUBLIC, anon, authenticated`; `GRANT` to `service_role`; explicit `service_role_all` policy — identical lockdown to `payment_side_effects`.

### D4 — Drain route (`POST /api/cron/drain-invalidations`, `CRON_SECRET`-gated)

Loop while it can claim a row (bounded by `maxDuration`/batch): claim → **stage 1** hard-expire the target's Next tags/paths with `{ expire: 0 }` (the named stale profile is forbidden here) → **stage 2** confirm Vercel tag deletion for every affected HTML response tag via the supported deletion control plane → **stage 3** purge Cloudflare URLs via a **new strict primitive** that returns structured per-batch outcomes (missing config / timeout / non-2xx / `200 + success:false` / partial failure / `429`+`Retry-After` are all retryable and never marked complete — replacing today's swallow-everything `purgeCloudflareUrls(): Promise<void>`, which is kept only as the legacy fail-open wrapper) → complete (generation-checked). Category invalidation must either purge the existing `ps:`/`ph:` tenant publication response tags or introduce and prove a category-specific HTML tag; Next data tags alone do not evict a Vercel CDN `HIT`. On any stage error the drainer calls the token-checked failure transition immediately; it records `last_error`, schedules `next_attempt_at` from bounded exponential backoff plus jitter (and never earlier than `Retry-After`), and parks the threshold attempt as `dead_letter` for alerting.

**Authority gate:** this route would be a new importer of service-role claim/fail/complete authority and CDN credentials. The existing temporary analytics exception does not authorize it. Owner/security approval of the exact route, RPC grants, credential projection, and boundary-manifest entry is required before implementation; no implementation plan may silently widen `manifest.authority.*`.

### D5 — Deploy discipline

The crontab line + `WEB_CRON_CONFIG` entry + `deploy.sh` block + `docs/ops/vps-workers.md` update ship in **one PR** (runbook mandate). Applying it to the VPS is a **separate owner-run step**. `CRON_SECRET` already matches web+VPS.

## Consequences

### Implementation boundary (2026-07-27)

The approved implementation uses `public.cache_invalidation_outbox` with one
immutable row per merchant and concrete storefront slug/hostname target. The
only drainer is `GET /api/cron/drain-cache-invalidations`, authenticated with
`CRON_SECRET` and invoked every two minutes through the existing VPS
`run-web-cron.mjs` wrapper. Its exact route/helper credential graph and
claim/finish RPCs are recorded in the event-pipeline boundary manifest. The VPS
receives no Supabase service-role or Cloudflare authority for this job.

The route claims successive two-target batches up to a fixed ten-target budget,
stops new claims after 30 seconds to reserve provider-call headroom inside its
60-second runtime, and fails with a fixed non-2xx signal whenever the aggregate
dead-letter alert RPC reports terminal work. Storefront slug targets include
the current slug and every durable historical alias; product triggers cover
all mutable storefront/feed projections while suppressing stock-only writes for
unlimited-stock products even when the generic `updated_at` stamp changes.

Each claimed generation hard-expires Next data, awaits Vercel tag deletion,
then confirms Cloudflare hostname purge before token-fenced completion. Any
stage failure records a bounded retry; a later generation cannot be completed
by an older claim. Applying the migration, installing the crontab, and raising
the five-minute TTL remain separate live-operations gates.

- **Positive:** matches the documented VPS-only scheduling architecture; reuses proven `run-web-cron` non-2xx alerting + `flock` overlap-prevention; avoids Vercel Cron scheduling and limits runtime to one bounded invocation per sweep; the ledger is durable in Postgres, so a VPS outage **delays, never loses** invalidations; the "big new build" shrinks to *generalize one table + add one route + one crontab line*.
- **Negative / accepted:** single VPS = a freshness SPOF (not a correctness one); adds to the VPS ops surface; crontab↔`deploy.sh` drift risk (mitigated by same-PR discipline); worst-case happy-path-drop latency = the sweep interval unless the optional trigger leg is added later.

## B0 exit checklist (before durable B1/B2 implementation)
- [ ] This ADR signed (owner: drain-latency SLA + VPS deploy discipline; owner/security: exact privileged route/RPC/credential authority and boundary-manifest change).
- [ ] Prototype migration `cache_invalidation_outbox` + enqueue/claim/complete/fail RPCs (draft: `supabase/migrations/…_cache_invalidation_outbox.sql`).
- [ ] Timed prototype demonstrating: claim → simulated crash → recover after lease expiry; retry failure → not reclaimable before `next_attempt_at` → reclaim after the delay; immediate Next expiry with no stale refill → mocked confirmed Vercel tag deletion (including a delayed multi-batch case inside the lease/deadline bound) → mocked strict Cloudflare call → generation-checked completion, with each stage failure preventing completion.
- [ ] Owner confirms VPS deploy step (crontab + `deploy.sh` + runbook in one PR).
