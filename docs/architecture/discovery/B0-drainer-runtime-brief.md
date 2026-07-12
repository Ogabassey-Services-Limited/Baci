# ADR-input brief — B0: drainer-runtime feasibility for a durable semantic-invalidation substrate

Read from `origin/main` @ `c8108a052dfccfb0c99f4c5e6cac96a56dad9587` (fetched). READ-ONLY research; nothing was edited.

**Headline:** the repo already made and documented the scheduling decision this ADR re-opens — *"Vercel cron scheduling is disabled in `vercel.json`; production schedules live in `vps-workers/deploy.sh` … Do not re-enable Vercel Cron unless the VPS worker architecture is intentionally rolled back."* (`docs/ops/vps-workers.md`). And it already ships the exact **enqueue → signed immediate trigger → cron-sweep-fallback → claim-based worker** pattern a durable-invalidation drainer wants (import jobs, AI-storefront jobs). So candidate (c) is the incumbent, not a hypothetical.

---

## 1. The `payment_side_effects` precedent — exact pattern + what generalizes

Files: `supabase/migrations/20260510120000_payment_side_effects.sql`, `apps/web/src/lib/payments/apply-paid-order-side-effects.ts`, `apps/web/src/lib/payments/apply-paid-order-side-effects-internals.ts`, `apps/web/src/scripts/reconcile-paystack-dva.ts`.

### 1a. The ledger table (EXACT)
`payment_side_effects` — outbox row per side-effect step of a paid order:
- **PK `(order_id, step)`** — the claim/dedup unit.
- `order_id UUID → orders(id) ON DELETE CASCADE`, `transaction_id UUID → transactions(id) ON DELETE CASCADE`.
- `step TEXT CHECK IN ('paid_email','firs_invoice','loyalty_points','ad_tracking_conversion','merchant_settlement')`.
- `status TEXT DEFAULT 'claimed' CHECK IN ('claimed','completed','failed')`.
- `claim_token UUID NOT NULL DEFAULT gen_random_uuid()`, `claimed_by TEXT NOT NULL`, `claimed_at TIMESTAMPTZ DEFAULT now()`, `completed_at TIMESTAMPTZ`, `result JSONB`, `error TEXT`, `attempts INT DEFAULT 1`.
- **Open-work index:** `payment_side_effects_open_idx ON (status, claimed_at) WHERE status != 'completed'` — this is the query a drainer scans.

### 1b. Claim / ON CONFLICT / stale-takeover (EXACT)
RPC `claim_payment_side_effect(p_order_id, p_transaction_id, p_step, p_claim_token, p_claimed_by) RETURNS TABLE(we_won boolean, current_status text)`, `SECURITY DEFINER SET search_path = public`. Body:
```
IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden: …'; END IF;
INSERT … VALUES (…, 'claimed', p_claim_token, p_claimed_by)
ON CONFLICT (order_id, step) DO UPDATE
  SET claim_token = EXCLUDED.claim_token, claimed_by = EXCLUDED.claimed_by,
      claimed_at = now(), status = 'claimed',
      attempts = payment_side_effects.attempts + 1
  WHERE payment_side_effects.status = 'failed'
     OR (payment_side_effects.status = 'claimed'
         AND payment_side_effects.claimed_at < now() - interval '60 seconds');
RETURN QUERY SELECT (pse.claim_token = p_claim_token) AS we_won, pse.status …;
```
Semantics: a **new** row wins outright; an existing row is re-claimed **only if `failed` or a stale claim (>60s)**; a `completed` row is a terminal no-op (the `WHERE` never matches). Two racing workers both `INSERT`; the partial `DO UPDATE` picks exactly one — the loser reads a `claim_token` that isn't theirs and gets `we_won = false`.

### 1c. Token-gated terminal transitions (EXACT)
`markCompleted` / `markFailed` (internals file) are `UPDATE payment_side_effects SET status=… WHERE order_id=? AND step=? AND claim_token=? .select('order_id')`. **0 rows returned ⇒ a peer took over while we ran** (`concurrentTakeoverSteps`). `markFailed` deliberately **does not throw** on DB error — it's already failing; the next replay retakes the stale claim.

### 1d. ACL / service-role lockdown (EXACT)
- `ENABLE ROW LEVEL SECURITY`; `REVOKE ALL … FROM PUBLIC, anon, authenticated`; `GRANT ALL … TO service_role`; plus explicit `service_role_all` policy `FOR ALL TO service_role USING(true) WITH CHECK(true)` (REVOKE/GRANT is primary, policy is layered defense).
- RPC `EXECUTE` revoked from PUBLIC/anon/authenticated, granted to `service_role`, **and** the in-body `auth.role() <> 'service_role'` guard (defense-in-depth against a future grant slip).
- Helper (`applyPaidOrderSideEffects`) is typed to `ReturnType<typeof createServiceClient>` (from `@/lib/supabase/service`, *not* `admin`), but the comment is explicit: "The TS type alone is documentation — real runtime safety is the RPC's `auth.role()='service_role'` guard."

### 1e. Orchestration + replay reality
`applyPaidOrderSideEffects` loops `STEP_ORDER`; per step: mint `crypto.randomUUID()` → `claimStep` → if `!we_won` push `skippedSteps` and continue → run executor (throw ⇒ `markFailed`) → `markCompleted` (0 rows ⇒ `concurrentTakeoverSteps`; throw *after* executor success ⇒ `markFailed` tagged `mark_completed_threw:` because the external effect already ran). `attempts` climbs on each takeover. `claimed_by` "actor" convention: `'webhook:<request_id>' | 'cron:<run_id>' | 'script:reconcile-paystack-dva'`.
**Crucial:** there is **no drainer loop in the precedent.** Replay is entirely *external* — webhook re-fire, the A2 reconcile script, or a referenced-but-not-present "B4 cron." The precedent supplies the durable **ledger + claim/lease**, not a runtime that scans `…_open_idx` and drains. That runtime is exactly what B0 adds.

### 1f. Generalizable vs order-specific
**Generalizable to a semantic-invalidation outbox (portable verbatim):**
1. `(entity_key, kind)` composite PK as the claim/dedup unit.
2. `claim_token` + `ON CONFLICT DO UPDATE WHERE status='failed' OR stale-claim(>N s)` lease/takeover (fresh claims block peers; completed = terminal).
3. Token-gated terminal `UPDATE … WHERE claim_token=? .select()` → detect concurrent takeover by row count.
4. `status` enum + `claimed_at`/`completed_at` + `attempts` + `claimed_by` + `result`/`error` JSONB.
5. Partial index `WHERE status != 'completed'` = the drainer's queue query.
6. `SECURITY DEFINER` RPC + in-body `auth.role()='service_role'` guard + REVOKE-all/GRANT-service_role + explicit RLS policy = service-role-only substrate.
7. Best-effort `markFailed` (never throw while merely recording failure).
8. **Boundary-idempotency principle:** the ledger dedups, but each side effect must *also* be idempotent at its own boundary, because a worker can die inside the lease window after acting but before marking. (For invalidation this is naturally satisfied — re-invalidating a cache tag is idempotent.)

**Order-specific (must be replaced / dropped):**
- Dual FKs `order_id` + `transaction_id → orders/transactions ON DELETE CASCADE`. A generic outbox needs an **entity-agnostic key** — a single `target TEXT` or `(target_kind, target_id)` plus maybe `reason`/`source`. Also decide the CASCADE story (invalidation targets may not be FK-backed rows).
- The `step` CHECK enum (5 payment effects) → an invalidation-`kind` enum (e.g. `product_cache`, `storefront_isr_tag`, `sitemap`, `merchant_feed`).
- The `financial-consistency` gate on `firs_invoice`/`loyalty_points`, the `payment_status='paid'` precondition, and the `order_transaction_mismatch` check — all payment-domain, drop them.
- The **60s lease** is tuned to email/settlement latency; invalidation drains are sub-second, so a shorter lease is fine — but it must still exceed worst-case drain time.

---

## 2. Current scheduling reality

**Vercel crons (quoted):** root `vercel.json` has exactly one —
`"crons": [{ "path": "/api/cron/web-vitals-health", "schedule": "0 4 * * *" }]` (daily 04:00 UTC), `"regions": ["dub1"]`. `apps/web/vercel.json` has `"crons": []`. `docs/ops/vps-workers.md` states plainly that Vercel cron is disabled and the ~24 `/api/cron/*` routes are **manual fallbacks only**.

**pg_cron:** **No `cron.schedule()` call exists in any migration.** pg_cron is *referenced* only by the retention-cleanup function that `DELETE FROM cron.job_run_details` (`20260524162010` + two hardening follow-ups) — implying the `cron` schema/extension is *present/enabled* on the project (likely via Supabase dashboard, not migration), but **nothing is scheduled through it in committed code.** Ironically the retention cleanup that name-drops pg_cron is itself run **from the VPS** (`vps-workers/jobs/supabase-retention-cleanup.mjs`, 03:20 daily), not by pg_cron. Net: pg_cron is *available* but *unused as a scheduler* in the repo.

**pg_net:** **Installed and in active use.** `CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions` in `20260418000000_baseline.sql` (re-asserted in `20260419140000_baseline_reality_assert.sql`). Trigger functions call `net.http_post(...)` to Supabase Edge Functions (`handle_new_negotiation → handle-negotiation`, `handle_new_staff_invite → send-staff-invite`, welcome-email, +1). Secret handling is the load-bearing detail for candidate (b): secrets are read at runtime from **`vault.decrypted_secrets`** (`name='project_url'`, `name='service_role_key'`) — **never embedded in the migration** — and the trigger fails-closed (`RAISE WARNING … skipping`) if a Vault secret is missing. `net._http_response` history is bounded by the retention cleanup.

**No persistent worker loop in the Next app.** Every `/api/cron/*` and `/api/ai-jobs/worker` handler is an on-demand `GET`/`POST` (e.g. `ai-jobs/worker` header comment: *"VPS web-cron/manual fallback entry point. Scheduled execution lives in vps-workers"*). The `setInterval`/`while(true)` hits in `apps/web/src` are all UI carousels/timers and paginating fetch loops — no server daemon.
**But persistent daemons DO exist — on the VPS, outside Next:** `deploy.sh` installs three `systemd --user` `Restart=always` HTTP listeners — `baci-vercel-log-drain-receiver`, `baci-ai-storefront-trigger`, `baci-import-job-trigger` — plus a delimited `# >>> baci-workers >>>` crontab block.

---

## 3. The three candidate drainer runtimes

Reused primitives across all options: `CRON_SECRET` Bearer auth (`hasValidCronSecret` in `apps/web/src/lib/cron-secret-auth.ts`, constant-time compare, accepts `Authorization: Bearer` or legacy `x-cron-secret`, fail-closed when unset), `maxDuration` export (60/300s seen; `agentic-commerce-health`/`process-import-jobs`/`reconcile-vtu-processing`/`storefront-update-nudge` = 300).

### (a) Vercel Cron → protected Route Handler
- **Feasibility:** technically proven end-to-end by `web-vitals-health` (Bearer + `hasValidCronSecret` + `maxDuration=60`). **But it directly contradicts the documented decision** (runbook: "Do not re-enable Vercel Cron…"). Project memory flags Vercel cost as a live concern (Fluid Compute is "the only cost lever").
- **Min interval:** 1-minute floor — **no sub-minute drain possible.** (Vercel Hobby is once/day + 2 crons max; Pro allows per-minute expressions but bills per invocation. The VPS already runs `*/5` and `*/15` schedules that Hobby couldn't and Pro would meter — see open question on plan tier.)
- **Max-duration:** capped at the route's `maxDuration` (≤300s on the tiers seen). Long drains must chunk + be re-entrant.
- **Overlap:** Vercel does **not** guarantee no-overlap; a slow tick can overlap the next. Safe here only because claim-leasing makes overlap harmless.
- **Pros:** zero new infra; native; secret pattern already built; visible in Vercel logs.
- **Cons:** reverses an explicit ADR/runbook; per-invocation cost; 1-min latency floor; overlap unmanaged; duration ceiling forces chunking; re-fragments the "one scheduler" model.
- **Open Qs:** current plan tier + cron quota; per-invocation cost of a frequent drainer; does the owner want to reverse the VPS-only decision?

### (b) Supabase pg_cron + pg_net → protected Route Handler
- **Feasibility:** pg_net is available and already used; pg_cron schema is present ⇒ a `cron.schedule('drain','* * * * *', $$ select net.http_post(url, headers) $$)` is technically possible. **Secret without embedding in the migration is a solved in-repo pattern:** read the drain secret from `vault.decrypted_secrets` at job runtime (exactly like the `net.http_post` triggers) — no literal in SQL.
- **Two real weaknesses:** (1) it would be the project's **first committed `cron.schedule()`** — a brand-new pattern with migration-drift risk (memory carries multiple "recorded ≠ applied" and "migration keyword in a comment broke deploy" scars) and dashboard-vs-migration ambiguity. (2) **`net.http_post` is fire-and-forget** — it returns a `request_id`, does not block for the response, does not surface non-2xx to the caller, and has no built-in retry; results land in `net._http_response` and must be polled. So you get a *trigger* but **no delivery guarantee and weak failure alerting** (vs `run-web-cron.mjs`'s exit-nonzero-alerts). The drainer's own ledger would still record true success, so it's workable, but paging on failure is harder.
- **Min interval:** every-minute standard; sub-minute needs pg_cron's seconds syntax (version-dependent — open question).
- **Overlap:** pg_cron doesn't prevent overlapping same-job runs either; claim-leasing covers it.
- **Pros:** no new infra; DB-native; Vault-secret pattern proven; independent of Vercel deploy state; trigger lives next to the data.
- **Cons:** first committed pg_cron schedule (drift/test-parity risk); fire-and-forget delivery (no guarantee, poor failure visibility); couples DB to web-origin availability; contradicts "schedules live in vps-workers."
- **Open Qs:** is pg_cron truly *enabled* on prod (schema-present ≠ enabled)? pg_cron version (sub-minute)? who owns/rotates the Vault drain secret? how to alert on pg_net non-2xx?

### (c) Owner-approved external / VPS worker  ← incumbent substrate
- **Feasibility: highest — already deployed.** The repo ships the whole toolkit:
  - `vps-workers/deploy.sh`: rsync + `pnpm install --frozen-lockfile --prod`, installs an **idempotent delimited `# >>> baci-workers >>>` crontab block**, and three `systemd --user Restart=always` listener services.
  - `vps-workers/jobs/run-web-cron.mjs`: the "call a `CRON_SECRET`-gated web route; **throw / exit non-zero on any non-2xx so the schedule alerts**" wrapper, with a per-path `WEB_CRON_CONFIG` (method + timeout), https-only + no-credentials-in-URL enforcement. **Adding a drainer = one `/api/cron/drain-invalidations` route + one `WEB_CRON_CONFIG` entry + one crontab line.**
  - Direct-to-Supabase service-role jobs already exist (`supabase-retention-cleanup.mjs`, `cleanup-agentic-request-records.mjs`) — a drainer could instead claim/drain straight against Postgres with the service key, skipping the web hop (at the cost of duplicating claim logic in `.mjs`).
  - **Signed-trigger listeners are the immediate-drain analog:** `ai-storefront-trigger-server.mjs` / `import-job-trigger-server.mjs` accept a signed web POST (constant-time secret via SHA-256 + `timingSafeEqual`, `127.0.0.1` + TLS reverse proxy, 4KB body cap) and `spawn` the worker under `flock` locks; cron every N min is the **recovery sweep**. Web side (`apps/web/src/lib/import-jobs/kickoff-import-job.ts` → `triggerImportJobWorker`): persist row → POST signed trigger → *cron fallback processes if the trigger is unconfigured/fails*. **This is precisely the durable-invalidation drainer shape.**
  - Env: `CRON_SECRET` (must match web + VPS, rotate together), `BACI_WEB_BASE_URL` (https origin, e.g. `https://ogabassey.com`), secrets in `/home/bassey/baci-workers/.env`.
- **Pros:** matches the documented ADR; reuses `run-web-cron` failure-alerting and `flock` overlap-prevention; supports **both** low-latency signed-trigger *and* periodic durable sweep; can run service-role SQL directly; owner already operates it; no Vercel cost; ships as one PR (runbook *mandates* editing `deploy.sh` + `docs/ops/vps-workers.md` together).
- **Cons:** single VPS = single point of failure — **but the ledger is durable in Postgres, so a VPS outage delays drains, it doesn't lose them** (as long as enqueue persists the row); adds to an already-loaded ops surface (SSH/systemd/logrotate/lock hygiene); requires owner sign-off to add a schedule; crontab↔`deploy.sh` drift risk if not deployed together; the immediate-trigger leg needs a new listener (or a new `run-web-cron` path + a signed web→VPS call).
- **Open Qs:** is sub-minute freshness required (⇒ signed-trigger leg) or does a 1–5 min sweep suffice? Drainer as a web route via `run-web-cron` (reuse web logic) or a direct-Supabase `.mjs` job (fewer hops, duplicate claim logic)? Who owns the VPS uptime SLA for invalidation freshness?

---

## Recommendation-lean

**Lean (c) — VPS worker as the primary drainer scheduler**, structured on the payment-side-effects generalization:
1. **Enqueue** writes a durable, claim-based outbox row (§1f generalizable set), keyed by an entity-agnostic `(target, kind)`.
2. **Optional low-latency leg:** web POSTs a signed trigger to a VPS listener (reuse the `ai-storefront-trigger-server` shape) → immediate drain under `flock`.
3. **Durable recovery:** a VPS crontab sweep every 1–5 min drains the `WHERE status != 'completed'` index — either via `run-web-cron.mjs` hitting a new `CRON_SECRET`-gated `/api/cron/drain-invalidations` route (reuse web logic, inherit exit-nonzero alerting) or a direct-Supabase `.mjs` job.

This matches the documented architecture, reuses proven alerting + overlap-prevention, costs nothing on Vercel, gives both low-latency and durable-sweep on a substrate the owner already runs, and — because the ledger is durable in Postgres — degrades to "delayed, not lost" if the VPS is down.

- **Reject (a) as the scheduler:** it reverses the explicit runbook decision, costs per-invocation, has a 1-min latency floor, and re-fragments scheduling. Keep a Vercel-cron/manual-`GET` fallback route only, in line with the other `/api/cron/*` routes — never the primary.
- **Treat (b) as an optional DB-native watchdog backstop, not primary:** its Vault-secret story is clean, but it's the first committed `pg_cron` schedule (drift risk) and `net.http_post` is fire-and-forget (no delivery guarantee, weak failure paging). Consider only if the owner wants a drain-liveness watchdog independent of the VPS. Default: no.

## Open decisions the owner must sign
1. **Drain-latency SLA** — is a 1–5 min sweep acceptable, or is a signed-trigger immediate-drain leg required?
2. **Runtime shape** — web route via `run-web-cron.mjs` (reuse web logic) vs direct-Supabase `.mjs` job (fewer hops, duplicate claim logic in `.mjs`).
3. **DB-native watchdog?** — add pg_cron+pg_net as an independent backstop, accepting the first committed `cron.schedule()` and its drift risk? (default: no.)
4. **Deploy discipline** — explicit approval to add a crontab entry and update `vps-workers/deploy.sh` **and** `docs/ops/vps-workers.md` in the same PR (runbook mandates this).
5. **Lease duration** for invalidation claims (payment used 60s; pick shorter but > worst-case drain time).
6. **Entity-key shape** for the generic outbox (`target TEXT` vs `(target_kind, target_id)`) replacing the `order_id`+`transaction_id` dual FK, plus the CASCADE/orphan story.
7. **Secret ownership** — reuse `CRON_SECRET` for the drain route; if adding the signed-trigger leg, a new `*_TRIGGER_SECRET` (matched web+VPS) and, for option (b), a Vault entry.
8. **Prerequisite confirmations** (only if (a) or (b) stay in scope) — current Vercel plan tier + cron quota/cost; whether pg_cron is truly *enabled* on prod (schema-present ≠ enabled) and its version (sub-minute support).
