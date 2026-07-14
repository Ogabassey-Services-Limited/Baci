# ADR B0 — Durable cache-invalidation substrate & drainer runtime

**Status:** proposed (design adopted 2026-07-11; implementation gated behind the workaround-retirement-plan non-security gate) · **Owner sign-off required for:** the VPS deploy step (crontab + `deploy.sh`) and the drain-latency SLA.
**Context source:** `docs/architecture/discovery/B0-drainer-runtime-brief.md`. **Verified vs** `origin/main@cff335b0fd`.

## Context

Raising Cloudflare/Vercel cache TTLs (the cost + LCP win in Workstream B2) is only safe if cache invalidation is *durable* — a dropped purge under a 1-hour TTL serves up to an hour of stale/removed content. Today `schedulePurgeCloudflareUrls` (`cache-revalidation.ts:61`) is fire-and-forget (`after()` / detached `void`), so purges can be silently lost. B0 selects and proves the durable substrate before any queue code, migration, or TTL change.

A durable system = a **claim-based outbox ledger** (Postgres) + a **drainer runtime** that scans it and performs the two-stage invalidation. The repo already has the ledger *pattern* (`payment_side_effects`) but **no drainer runtime** — that runtime is what B0 decides.

## Decision

### D1 — Runtime: VPS cron sweep → a `CRON_SECRET`-gated web route (incumbent option c)

Adopt the existing VPS worker as the durable scheduler. Add **one** `CRON_SECRET`-gated route `POST /api/cron/drain-invalidations`, driven by the VPS `run-web-cron.mjs` on a `flock`-guarded crontab line — the same shape already used for ~15 jobs (`cleanup-orders`, `process-settlements`, `agentic-commerce-health`, …).

**Why the drainer is a web route and NOT a direct-Supabase `.mjs` job (hard constraint, resolves the brief's open Q2):** the two-stage delivery must invalidate the Next Data Cache first (`revalidateTag`/`revalidatePath`, imported from `next/cache` in `cache-revalidation.ts:13`), which is a Next-runtime-only API. A standalone `.mjs` VPS job physically cannot run it, so an edge purge from a `.mjs` job could refill from stale Next-cached data — the exact failure B2a forbids. The drainer therefore runs *in the Next runtime*, invoked by the VPS.

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
| `merchant_id uuid` + `target_kind text` + `target_id text` | **PK** = one concrete invalidation target (`target_kind` ∈ product_cache / category_listing / storefront_document / sitemap / merchant_feed …; `target_id` = the exact tag/path/URL key). `merchant_id` references `merchants(id) ON DELETE CASCADE`. A rename/domain move enqueues separate old and new targets, so later coalescing cannot discard an earlier stale path. |
| `generation bigint` | bumped on every enqueue; the "latest mutation" marker |
| `status text` (`pending`/`claimed`/`completed`/`failed`/`dead_letter`) | drain state; `dead_letter` is excluded from claims and requires operator action |
| `claim_token uuid`, `claimed_generation bigint`, `claimed_by text`, `claimed_at timestamptz` | lease |
| `completed_generation bigint`, `completed_at`, `attempts int`, `last_error text` | terminal/retry state |
| `payload jsonb` | delivery metadata for this concrete target; never the sole storage for additional stale paths |

- **Open-work index:** `... (status, claimed_at) WHERE status NOT IN ('completed','dead_letter')` — the drainer's queue query.
- **Enqueue** (in-mutation): `INSERT … generation=1, status='pending' ON CONFLICT (merchant_id,target_kind,target_id) DO UPDATE SET generation = outbox.generation + 1, status = 'pending', attempts = 0, payload = EXCLUDED.payload` — re-queues even a completed/dead-letter row. Enqueue one row per concrete target (for A→B→C, retain A, B, and C target rows). The helper is `SECURITY DEFINER` but ungranted to client roles and is invoked only by trusted definer mutation RPCs/triggers; it must not reject an outer authenticated JWT by checking `auth.role()`.
- **Claim** (`SECURITY DEFINER`, `service_role`-only + null-safe `auth.role() IS DISTINCT FROM 'service_role'` guard, mirroring `claim_payment_side_effect`): take a `pending`/`failed`/stale-`claimed` (> lease) row only while `attempts < max_attempts`, set `claimed_generation = generation`, `status='claimed'`, `claim_token`, `claimed_at=now()`, `attempts += 1`; return `we_won`. If a worker crashes on the threshold attempt, the next claim call parks the expired lease as `dead_letter` instead of leaving it stranded as `claimed`.
- **Complete:** `UPDATE … SET status='completed', completed_generation=claimed_generation WHERE claim_token=? AND generation = claimed_generation` — **if `generation` advanced during the drain, the row is NOT marked complete and re-drains** (generation-aware idempotency). Re-purging a tag/URL is idempotent, so a mid-lease crash after purging but before completing is harmless.
- **Fail:** a service-role-only, null-safe `fail_cache_invalidation` transition requires the matching claim token and generation, records `last_error`, and moves the row to `failed` (immediately claimable) or `dead_letter` once `attempts >= max_attempts`.
- **Lease = 30s** (sub-second drains; comfortably > worst-case Next-invalidate + Cloudflare batch; shorter than payment's 60s since there's no email/settlement latency).
- **ACL:** RLS enabled; `REVOKE ALL FROM PUBLIC, anon, authenticated`; `GRANT` to `service_role`; explicit `service_role_all` policy — identical lockdown to `payment_side_effects`.

### D4 — Drain route (`POST /api/cron/drain-invalidations`, `CRON_SECRET`-gated)

Loop while it can claim a row (bounded by `maxDuration`/batch): claim → **stage 1** `revalidateTag`/`revalidatePath` the target's Next tags → **stage 2** purge Cloudflare URLs via a **new strict primitive** that returns structured per-batch outcomes (missing config / timeout / non-2xx / `200 + success:false` / partial failure / `429`+`Retry-After` are all retryable and never marked complete — replacing today's swallow-everything `purgeCloudflareUrls(): Promise<void>`, which is kept only as the legacy fail-open wrapper) → complete (generation-checked). On delivery error the drainer calls the token-checked failure transition immediately; it records `last_error`, makes retryable rows claimable without waiting for lease expiry, and parks the threshold attempt as `dead_letter` for alerting.

### D5 — Deploy discipline

The crontab line + `WEB_CRON_CONFIG` entry + `deploy.sh` block + `docs/ops/vps-workers.md` update ship in **one PR** (runbook mandate). Applying it to the VPS is a **separate owner-run step**. `CRON_SECRET` already matches web+VPS.

## Consequences

- **Positive:** matches the documented VPS-only scheduling architecture; reuses proven `run-web-cron` non-2xx alerting + `flock` overlap-prevention; zero Vercel cost; the ledger is durable in Postgres, so a VPS outage **delays, never loses** invalidations; the "big new build" shrinks to *generalize one table + add one route + one crontab line*.
- **Negative / accepted:** single VPS = a freshness SPOF (not a correctness one); adds to the VPS ops surface; crontab↔`deploy.sh` drift risk (mitigated by same-PR discipline); worst-case happy-path-drop latency = the sweep interval unless the optional trigger leg is added later.

## B0 exit checklist (before durable B1/B2 implementation)
- [ ] This ADR signed (owner: drain-latency SLA + VPS deploy discipline).
- [ ] Prototype migration `cache_invalidation_outbox` + claim/enqueue/complete RPCs (draft: `supabase/migrations/…_cache_invalidation_outbox.sql`).
- [ ] Timed prototype demonstrating: claim → simulated crash → recover after lease expiry → Next invalidation → mocked Cloudflare call → generation-checked completion.
- [ ] Owner confirms VPS deploy step (crontab + `deploy.sh` + runbook in one PR).
