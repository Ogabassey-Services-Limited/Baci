# B0 Canonical Storefront Cache Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a disabled-by-default category cache canary using #3077’s canonical event, PGMQ, delivery, retry, dead-letter, replay, audit, and existing continuous-worker substrate without changing analytics or cache TTLs.

**Architecture:** An enabled database category trigger atomically creates normal `storefront.cache_transition.v1` PGMQ identity plus a specialized obligation. The capable existing router recognizes that exact trusted event, creates one `storefront_cache_transition` delivery, and atomically archives the message. The existing delivery worker calls one narrow authenticated Vercel actuator; that actuator builds a dedicated category barrier from existing category invalidation, product/feed invalidation, Vercel publication-tag, and confirmed hostname-purge primitives, then returns a typed full-barrier receipt before canonical completion/retry/DLQ/replay.

**Tech Stack:** Supabase PostgreSQL/RLS/`SECURITY DEFINER`, #3077 PGMQ/event deliveries, Next/Vercel cache APIs, TypeScript/Zod/Vitest, existing VPS worker services, confirmed Cloudflare hostname purge.

## Global Constraints

- One event name: `storefront.cache_transition.v1`; one destination: `storefront_cache_transition`.
- Reuse `domain_event_ledger`, PGMQ, `event_deliveries`, attempts, retry, dead letter, replay, audit, heartbeats, `process-domain-events.ts`, and `process-event-deliveries.ts`.
- Do not add an outbox, second queue, queue-less ledger, direct-obligation ingress, two destinations, cron route/schedule/service/listener, Cache-Tag/origin Cache-Tag work, `proxy.ts` edit, or TTL/SWR/cache-directive change.
- The specialized table is `storefront_cache_transition_obligations`; it stores semantic target data, generation, and successor, never queue or per-stage checkpoint state.
- Use service-only `storefront_cache_transition_canaries`; triggers cannot read environment merchant allowlists.
- PGMQ read has no predicate: shared ingress is a bounded launch risk. Stale routers must DB-refuse/defer this event and never dead-letter it. Fresh capable-router/delivery heartbeats, queue-age alerting, and load/poison-message latency tests gate producer activation.
- Worker owns service role only. Actuator has dedicated worker auth, reuses existing publication-cache Cloudflare authority, and has no Supabase/service-role/database claim/retry/finish authority.
- B0 is substrate plus category canary only; critical shells, renderer, PDP/product/blog/import/inventory coverage, broad canaries, and TTL changes are excluded.

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260727143000_storefront_cache_transition.sql` | Event/destination, DB canary config, DELETE-safe trigger snapshots, obligation/successor coalescing, router guards, claim/generation-fenced finish RPCs. |
| `supabase/tests/storefront_cache_transition.sql` | Atomicity, PGMQ routing, stale-router, coalescing, stage, retry/DLQ/replay SQL cases. |
| `apps/web/src/scripts/domain-event-worker-batch.ts` | Exact capable-router branch. |
| `apps/web/src/scripts/process-storefront-cache-transition.ts` | Separate destination-filtered delivery lane. |
| `apps/web/src/app/api/internal/storefront-cache-actuator/route.ts` | Dedicated-auth idempotent full category barrier: Next, Vercel, confirmed hostname purge. |

---

### Task 0: Commit the delegated decision and authority ceiling before code

**Files:**
- Modify: `docs/architecture/adr/B0-durable-cache-invalidation-substrate.md`
- Modify: `docs/architecture/workaround-retirement-plan.md`
- Create: `docs/superpowers/plans/2026-07-27-b0-durable-cache-invalidation-on-3077.md`

**Approved scope:** owner approval is limited to (a) exact new cache RPC caller receipts pinned after their real implementations in Task 5, and (b) one dedicated-auth actuator with a narrow server-only closure over existing category/publication/confirmed-hostname primitives in Task 3. It does not approve a worker Cloudflare credential, TTL/SWR/directive changes, `proxy.ts`, Cache-Tag work, any `EVENT_PIPELINE_BOUNDARY.authority.*` widening, a new VPS service/schedule, or analytics authority change.

- [x] **Step 1: Prove the current authority baseline before recording the decision**

Run: `pnpm --filter web exec vitest run src/lib/events/event-pipeline-boundary-manifest.test.ts && git diff --check`

Expected: PASS. This documentation-only gate does not add unpublished RPC names to the typed boundary and does not rewrite production-history attestation fixtures.

- [x] **Step 2: Record the adopted architecture and exact authority ceiling**

Keep the ADR, retirement plan, and this implementation plan consistent on one event/destination, normal #3077 PGMQ ingress, existing services only, Vercel-side full barrier, fixed OgaBassey hostname scope, and byte-identical authority arrays.

- [x] **Step 3: Re-run the baseline and commit the approval record**

Run: `pnpm --filter web exec vitest run src/lib/events/event-pipeline-boundary-manifest.test.ts && git diff --check`

Expected: PASS.

```bash
git add docs/architecture/adr/B0-durable-cache-invalidation-substrate.md docs/architecture/workaround-retirement-plan.md docs/superpowers/plans/2026-07-27-b0-durable-cache-invalidation-on-3077.md
git commit -m "docs: adopt canonical cache transition design"
```

### Task 1: Create canonical producer, executable canary gate, and coalescing

**Files:**
- Create: `supabase/migrations/20260727143000_storefront_cache_transition.sql`
- Create: `supabase/migrations/20260727143100_storefront_cache_transition_delivery.sql`
- Create: `supabase/tests/storefront_cache_transition.sql`
- Create: `supabase/tests/event_pipeline_local_catalog.sql`
- Create: `supabase/tests/storefront_cache_transition_replay.sql`
- Modify: `apps/web/src/lib/domain-event-pipeline-migration.test.ts`
- Modify: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify: `apps/web/tools/db/expected-pending-sources.test-support.ts`
- Modify: `apps/web/tools/db/verify-supabase-history-replay-manifest.test.ts`
- Modify: `apps/web/src/lib/events/event-contract.ts`
- Modify: `apps/web/src/lib/events/event-contract.test.ts`
- Modify: `apps/web/src/lib/events/event-route-destination.ts`
- Create: `apps/web/src/lib/events/event-route-destination.test.ts`
- Modify: `apps/web/src/lib/events/event-route-resolution.ts`
- Modify: `apps/web/src/lib/events/event-route-resolution.test.ts`
- Modify: `apps/web/src/lib/events/event-pipeline-active-destinations.ts`
- Modify: `apps/web/src/lib/events/event-pipeline-active-destinations.test.ts`
- Modify: `apps/web/src/schemas/claimed-event-delivery-schema.ts`
- Modify: `apps/web/src/schemas/claimed-event-delivery-schema.test.ts`
- Modify: `apps/web/src/types/supabase.ts`

**Interfaces:**
- Produces SQL-internal `ensure_storefront_cache_transition_from_category_row_v1(p_operation text, p_old_id uuid, p_old_merchant_id uuid, p_old_slug text, p_old_name text, p_old_is_active boolean, p_old_parent_id uuid, p_new_id uuid, p_new_merchant_id uuid, p_new_slug text, p_new_name text, p_new_is_active boolean, p_new_parent_id uuid) returns uuid`.
- Produces `storefront_cache_transition_canaries(merchant_id uuid primary key, enabled boolean, updated_at timestamptz)`.
- Produces `storefront_cache_transition_obligations(id uuid primary key, domain_event_id uuid unique, successor_of uuid, generation bigint, status text, payload jsonb)`.

- [x] **Step 1: Write failing migration-contract tests**

```ts
expect(sql).toContain("'storefront.cache_transition.v1'");
expect(sql).toContain("'storefront_cache_transition'");
expect(sql).toContain('storefront_cache_transition_canaries');
expect(sql).toContain('storefront_cache_transition_obligations');
expect(sql).toContain('successor_of');
expect(sql).toContain('generic_cache_transition_dead_letter_forbidden');
```

- [x] **Step 2: Run the test and confirm failure**

Run: `pnpm --filter web exec vitest run src/lib/domain-event-pipeline-migration.test.ts src/lib/events/event-contract.test.ts src/lib/events/event-route-destination.test.ts src/lib/events/event-route-resolution.test.ts src/lib/events/event-pipeline-active-destinations.test.ts src/schemas/claimed-event-delivery-schema.test.ts`

Expected: FAIL because the migration is absent.

- [x] **Step 3: Implement the one canonical transaction**

Complete the single migration before committing it: create the RLS-forced, service-role-only canary and obligation tables; the category trigger and revoked/private `ensure_storefront_cache_transition_from_category_row_v1`; and all three specialized route, claim, and generation-fenced finish RPCs. The helper receives only the trigger's TG_OP and safe OLD/NEW scalar snapshots. It supports DELETE without a post-delete lookup, derives merchant/category/old-new semantic keys, and uses #3077’s normal enqueue path so ledger and PGMQ identity commit with the source mutation. It has no client grants or merchant, URL, hostname, tag, or path input. The migration also installs the stale-router defer/no-generic-dead-letter guards and excludes `storefront_cache_transition` from the generic delivery claim. Task 2 wires TypeScript callers to this already-committed SQL; it does not reopen the migration.

Before claim, update one pending obligation in place by incrementing `generation`. Once claimed, never mutate its generation: create or update at most one pending successor event/obligation via `successor_of`. The schema allows a claimed predecessor plus one pending successor; cache claim blocks that successor until the predecessor delivery is terminal, while further mutations coalesce into the pending successor. The delivery worker materializes current obligation state, not the stale envelope.

- [x] **Step 4: Add SQL lifecycle cases**

```sql
-- Rollback category DML leaves zero ledger, PGMQ, obligation, and delivery rows.
-- Enabled canary commits one normal queue message and one obligation.
-- Disabled producer/non-canary creates none.
-- Pre-claim changes coalesce; post-claim change creates one successor.
-- Claimed parent plus pending successor succeeds; a second pending tail fails.
-- Successor claim is blocked until parent terminal, then succeeds.
-- Older completion cannot complete successor generation.
```

Add a separate local-only catalog contract in `supabase/tests/event_pipeline_local_catalog.sql`. It must derive canonical function identities from `pg_get_function_identity_arguments`, hash reviewed definitions/configuration/security/ACL material from the live replay catalog, and assert exact signatures and digests for the full 22-function `EVENT_PIPELINE_FUNCTION_NAMES` set. The existing 19-function production-effect query and receipt remain untouched. Keep both B0 migrations within the repository's 300-line ceiling. After the migration bytes are final, register both SHAs in `supabase-history-replay-sources.ts`, mirror them in `expected-pending-sources.test-support.ts`, and update the manifest pending-source count test from 44 to 46.

- [x] **Step 5: Apply locally, refresh checked-in types, and run focused validation**

The historical replay intentionally excludes `PENDING_SOURCES`. Use a local-only overlay check that `\ir`s exactly `20260726103000_atomic_category_hierarchy_lifecycle.sql`, `20260726201000_harden_category_hierarchy_lifecycle.sql`, and both ordered B0 migrations before it runs the lifecycle and catalog contracts. Do not change replay materialization or apply the unrelated pending migration batch.

Run: `pnpm --filter web exec tsx tools/db/run-supabase-history-replay.ts --mode chronological --pending-repair-state materialized --comparison-mode classify --sql-check supabase/tests/storefront_cache_transition_replay.sql --types-output apps/web/src/types/supabase.ts && pnpm --filter web exec vitest run src/lib/domain-event-pipeline-migration.test.ts src/lib/events/event-contract.test.ts src/lib/events/event-route-destination.test.ts src/lib/events/event-route-resolution.test.ts src/lib/events/event-pipeline-active-destinations.test.ts src/schemas/claimed-event-delivery-schema.test.ts tools/db/supabase-history-replay-manifest.test.ts tools/db/verify-supabase-history-replay-manifest.test.ts`

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add supabase/migrations/20260727143000_storefront_cache_transition.sql supabase/migrations/20260727143100_storefront_cache_transition_delivery.sql supabase/tests/storefront_cache_transition.sql supabase/tests/event_pipeline_local_catalog.sql supabase/tests/storefront_cache_transition_replay.sql apps/web/src/lib/domain-event-pipeline-migration.test.ts apps/web/tools/db/supabase-history-replay-sources.ts apps/web/tools/db/expected-pending-sources.test-support.ts apps/web/tools/db/verify-supabase-history-replay-manifest.test.ts apps/web/src/lib/events/event-contract.ts apps/web/src/lib/events/event-contract.test.ts apps/web/src/lib/events/event-route-destination.ts apps/web/src/lib/events/event-route-destination.test.ts apps/web/src/lib/events/event-route-resolution.ts apps/web/src/lib/events/event-route-resolution.test.ts apps/web/src/lib/events/event-pipeline-active-destinations.ts apps/web/src/lib/events/event-pipeline-active-destinations.test.ts apps/web/src/schemas/claimed-event-delivery-schema.ts apps/web/src/schemas/claimed-event-delivery-schema.test.ts apps/web/src/types/supabase.ts
git commit -m "feat: add canonical cache transition obligation"
```

### Task 2: Make category production atomic and route on the capable existing router

**Files:**
- Modify: `apps/web/src/scripts/domain-event-worker-batch.ts`
- Modify: `apps/web/src/scripts/domain-event-worker-batch.test.ts`
- Create: `apps/web/src/scripts/domain-event-worker-cache-routing.test.ts`
- Modify: `apps/web/src/scripts/domain-event-worker.ts`
- Modify: `apps/web/src/scripts/domain-event-worker.test.ts`
- Modify: `apps/web/src/scripts/process-domain-events.ts`
- Modify: `apps/web/src/lib/events/event-pipeline-config.ts`
- Create: `apps/web/src/lib/events/storefront-cache-transition-routing-enabled.ts`
- Create: `apps/web/src/lib/events/storefront-cache-transition-routing-enabled.test.ts`

**Interfaces:**
- Consumes the Task 1 `capture_category_cache_transition_v1()` trigger and specialized route RPC without changing their committed migration.
- Consumes only parsed/trusted `storefront.cache_transition.v1` PGMQ records.

- [x] **Step 1: Write failing trigger/router tests**

```ts
expect(await routeBatch(cacheMessage)).toEqual({ cacheTransitions: 1 });
expect(genericDeadLetter).not.toHaveBeenCalled();
```

Add the runner matrix: both flags disabled exits before creating a client; generic disabled/cache enabled routes cache and defers analytics; generic enabled/cache disabled routes analytics and DB-defers cache without dead-letter; both enabled route each through its own branch. Cache-only shared reads remain subject to the documented queue-age/load gate and may not activate generic analytics delivery.

- [x] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter web exec vitest run src/scripts/domain-event-worker-batch.test.ts src/scripts/process-domain-events.test.ts src/lib/events/storefront-cache-transition-routing-enabled.test.ts`

Expected: FAIL because trigger/router branch is absent.

- [x] **Step 3: Implement the trigger and bounded shared ingress**

Use the `AFTER INSERT OR UPDATE OR DELETE` category trigger and specialized RPCs already committed in Task 1. The trigger checks producer config plus the service-only canary table; enabled failures roll back the mutation. In the existing capable router, dispatch only the exact parsed event to the specialized operation that validates obligation, inserts/reuses one delivery, marks it routed, and atomically archives the exact PGMQ message.

Add DB refusal/defer for stale router and DB refusal for generic ingress dead letter. Do not claim pre-read isolation. Add the dedicated routing flag leaf default false and export it from the existing config barrel. Refactor the current early return so a cache-only run can create the client/read shared ingress while analytics messages are deferred, never routed merely because the cache flag is on. Unit tests prove the four runner modes, cache poison isolation, and specialized-route ownership. The existing heartbeat schema has no build/capability field and the repository has signals but no alert transport, so deployed-artifact capability, fresh heartbeat, queue-age alert wiring, and load/poison latency are Task 5 rollout proofs rather than synthetic Task 2 claims.

- [x] **Step 4: Run focused validation**

Run: `pnpm --filter web exec vitest run src/scripts/domain-event-worker-batch.test.ts src/scripts/process-domain-events.test.ts src/lib/events/storefront-cache-transition-routing-enabled.test.ts`

Expected: PASS with analytics routing unchanged.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/scripts/domain-event-worker-batch.ts apps/web/src/scripts/domain-event-worker-batch.test.ts apps/web/src/scripts/domain-event-worker-cache-routing.test.ts apps/web/src/scripts/domain-event-worker.ts apps/web/src/scripts/domain-event-worker.test.ts apps/web/src/scripts/process-domain-events.ts apps/web/src/scripts/process-domain-events.test.ts apps/web/src/lib/events/event-pipeline-config.ts apps/web/src/lib/events/storefront-cache-transition-routing-enabled.ts apps/web/src/lib/events/storefront-cache-transition-routing-enabled.test.ts docs/superpowers/plans/2026-07-27-b0-durable-cache-invalidation-on-3077.md
git commit -m "feat: route canonical cache transition event"
```

### Task 3: Add constrained authenticated Next/Vercel actuator

**Files:**
- Create: `apps/web/src/app/api/internal/storefront-cache-actuator/route.ts`
- Create: `apps/web/src/app/api/internal/storefront-cache-actuator/route.test.ts`
- Create: `apps/web/src/lib/events/storefront-cache-actuator-auth.ts`
- Create: `apps/web/src/lib/events/storefront-cache-actuator-auth.test.ts`
- Create: `apps/web/src/schemas/storefront-cache-actuator.ts`
- Create: `apps/web/src/schemas/storefront-cache-actuator.test.ts`
- Create: `apps/web/src/lib/storefront-category-cache-barrier.ts`
- Create: `apps/web/src/lib/storefront-category-cache-barrier.test.ts`
- Create: `apps/web/src/lib/events/storefront-cache-transition-boundary.test.ts`

**Interfaces:**
- Produces `POST(request)` for the exact flat schema-v1 body below; there is no nested or caller-extensible operation payload.
- Uses `STOREFRONT_CACHE_ACTUATOR_SECRET` for auth and requires existing Vercel runtime Cloudflare configuration through the exact helper closure, with no raw token/env reads.

**Raw request contract:** strict schema v1 is `{ schemaVersion: 1, obligationId: uuid, generation: positiveInt, merchantId: uuid, previousSlug: string|null, nextSlug: string|null, relatedSlugs: string[] }`. It accepts no identity arrays, hosts, URLs, or operation names. At least one previous/next/related slug is required; normalize/dedupe under the existing category-slug grammar and cap the array. Header `x-baci-storefront-cache-timestamp` is base-10 Unix seconds and `x-baci-storefront-cache-signature` is exact `v1=<64 lowercase hex>`. Before JSON parsing, reject skew over 60 seconds, compute UTF-8 `${timestamp}\n${sha256(rawBody).lowerHex}`, HMAC-SHA256 it with the actuator secret, decode and compare MACs with `timingSafeEqual`. The typed receipt binds `{ schemaVersion:1, obligationId, generation, requestBodySha256, completedAt }`; worker accepts only an exact match. Same signed replay in-window is allowed because the barrier is idempotent.

- [x] **Step 1: Write failing auth/isolation tests**

```ts
expect((await POST(unsignedRequest)).status).toBe(401);
expect(revalidateCategories).toHaveBeenCalledWith(CANARY_MERCHANT_ID, oldSlug, { expireImmediately: true });
expect(purgeVercelStorefrontPublicationCache).toHaveBeenCalledBefore(purgeCloudflareHostnamesConfirmed);
expect(responseBody).toEqual({ ok: true, receipt: expect.any(Object) });
expect(source).not.toMatch(/supabase|finish_event_delivery/);
```

- [x] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter web exec vitest run src/app/api/internal/storefront-cache-actuator/route.test.ts src/lib/events/storefront-cache-actuator-auth.test.ts src/schemas/storefront-cache-actuator.test.ts src/lib/storefront-category-cache-barrier.test.ts src/lib/events/storefront-cache-transition-boundary.test.ts`

Expected: FAIL because actuator is absent.

- [x] **Step 3: Implement idempotent bounded operation**

Implement strict Zod `storefrontCacheActuatorSchema` for the exact raw request contract above; reject unknown fields, absolute URLs, identity arrays, explicit hosts/purge targets, and caller-selected operations. Route only authenticates, validates, and delegates. Server-only `runStorefrontCategoryCacheBarrier` requires the signed merchant UUID to equal `STOREFRONT_CACHE_CANARY_MERCHANT_ID`, reconstructs the fixed OgaBassey publication identity, and verifies the existing builder returns exactly `ogabassey.com,www.ogabassey.com`. It fails closed outside Vercel, then calls positional `revalidateCategories(merchantId, slug, { expireImmediately: true })`, requires `productCacheRevalidation.revalidateProducts(merchantId, undefined, { expireImmediately: true, feedScope: 'merchant' }) === true`, foreground Vercel publication-tag purge, then confirmed hostname purge. Reject `not_running_on_vercel` and all failed stages; return the exact request-bound typed receipt only on success.

- [x] **Step 4: Run focused validation and commit**

Run: `pnpm --filter web exec vitest run src/app/api/internal/storefront-cache-actuator/route.test.ts src/lib/events/storefront-cache-actuator-auth.test.ts src/schemas/storefront-cache-actuator.test.ts src/lib/storefront-category-cache-barrier.test.ts src/lib/events/storefront-cache-transition-boundary.test.ts`

Expected: PASS.

```bash
git add apps/web/src/app/api/internal/storefront-cache-actuator/route.ts apps/web/src/app/api/internal/storefront-cache-actuator/route.test.ts apps/web/src/lib/events/storefront-cache-actuator-auth.ts apps/web/src/lib/events/storefront-cache-actuator-auth.test.ts apps/web/src/schemas/storefront-cache-actuator.ts apps/web/src/schemas/storefront-cache-actuator.test.ts apps/web/src/lib/storefront-category-cache-barrier.ts apps/web/src/lib/storefront-category-cache-barrier.test.ts apps/web/src/lib/events/storefront-cache-transition-boundary.test.ts
git commit -m "feat: add idempotent cache actuator"
```

### Task 4: Add full-barrier receipt and generation-fenced finish to existing worker

**Files:**
- Create: `apps/web/src/scripts/process-storefront-cache-transition.ts`
- Create: `apps/web/src/scripts/process-storefront-cache-transition.test.ts`
- Modify: `apps/web/src/scripts/event-delivery-worker.ts`
- Modify: `apps/web/src/scripts/process-event-deliveries.ts`
- Create: `apps/web/src/lib/events/storefront-cache-transition-delivery-enabled.ts`
- Create: `apps/web/src/lib/events/storefront-cache-transition-delivery-enabled.test.ts`
- Modify: `apps/web/src/lib/events/event-pipeline-config.ts`

**Interfaces:**
- Produces `processStorefrontCacheTransition(client, delivery, dependencies): Promise<void>`.
- Claims only `storefront_cache_transition`; generic analytics claim excludes it.

- [ ] **Step 1: Write failing full-barrier receipt/finish tests**

```ts
await processStorefrontCacheTransition(client, delivery, deps);
expect(deps.callActuator).toHaveBeenCalledTimes(1);
expect(deps.receipt).toEqual(expect.objectContaining({ ok: true }));
expect(deps.finishStorefrontCacheTransition).toHaveBeenCalledWith(expect.objectContaining({ generation, outcome: 'delivered' }));
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter web exec vitest run src/scripts/process-storefront-cache-transition.test.ts src/lib/events/storefront-cache-transition-delivery-enabled.test.ts`

Expected: FAIL because lane is absent.

- [ ] **Step 3: Implement persisted stages**

Add a dedicated `isStorefrontCacheTransitionDeliveryEnabled` config leaf that defaults false, export it from the existing config barrel, and wire an isolated existing-worker lane. Materialize current obligation/successor, call the fixed HTTPS `STOREFRONT_CACHE_ACTUATOR_URL`, and use its exact request-bound typed receipt as the only success boundary before `finish_storefront_cache_transition_delivery_v1`. That RPC atomically fences delivery claim, obligation ID, and generation before applying canonical terminal/retry semantics. Stale token/generation updates zero rows. The worker has no Cloudflare credential, hostname builder, or per-stage checkpoint RPC.

Treat actuator rejection of request authentication or Vercel runtime provenance, unknown merchant, `not_running_on_vercel`, timeout, network failure, missing receipt, or invalid/mismatched receipt as cache-specific retryable/fail-closed. The response contract is the exact request-bound typed receipt over HTTPS; it does not invent a second unsigned response-signature header. Because every barrier stage is idempotent, retry reruns the whole barrier; only an exact matching typed receipt succeeds. Existing retry ceiling/DLQ/replay/audit remain authoritative. Keep legacy `purgeCloudflareUrls()` unchanged.

- [ ] **Step 4: Run validation and commit**

Run: `pnpm --filter web exec vitest run src/scripts/process-storefront-cache-transition.test.ts src/scripts/process-event-deliveries.test.ts src/lib/events/storefront-cache-transition-delivery-enabled.test.ts`

Expected: PASS for crash/retry after each stage, successor, stale token, 429, DLQ, replay.

```bash
git add apps/web/src/scripts/process-storefront-cache-transition.ts apps/web/src/scripts/process-storefront-cache-transition.test.ts apps/web/src/scripts/event-delivery-worker.ts apps/web/src/scripts/process-event-deliveries.ts apps/web/src/lib/events/storefront-cache-transition-delivery-enabled.ts apps/web/src/lib/events/storefront-cache-transition-delivery-enabled.test.ts apps/web/src/lib/events/event-pipeline-config.ts
git commit -m "feat: deliver cache transition in existing worker"
```

### Task 5: Pin authority and run rollout gate without new scheduler

**Files:**
- Modify: `apps/web/src/lib/events/event-pipeline-database.ts`
- Modify: `apps/web/src/lib/events/event-pipeline-database.test.ts`
- Modify: `apps/web/src/lib/events/event-pipeline-boundary-manifest.ts`
- Modify: `apps/web/src/lib/events/event-pipeline-boundary-manifest.test.ts`
- Modify: `apps/web/src/env.ts`
- Modify: `apps/web/src/env.test.ts`
- Modify: `vps-workers/install-event-pipeline-services.sh`
- Modify: `vps-workers/deploy.sh`
- Modify: `vps-workers/jobs/deploy-crontab.test.mjs`
- Modify: `docs/ops/durable-event-pipeline.md`

- [ ] **Step 1: Write failing authority/deployment tests**

```ts
expect(manifest.callers['apps/web/src/scripts/process-storefront-cache-transition.ts']).toContain('finish_storefront_cache_transition_delivery_v1');
expect(manifest.callers['apps/web/src/scripts/domain-event-worker-batch.ts']).toContain('route_storefront_cache_transition_v1');
expect(actuatorSource).not.toMatch(/supabase|CLOUDFLARE_API_TOKEN/);
expect(productionHistoryFunctionNames).toHaveLength(19);
expect(EVENT_PIPELINE_FUNCTION_NAMES).toEqual([
  ...productionHistoryFunctionNames,
  ...storefrontCacheTransitionLocalFunctionNames,
].sort());
```

```js
assert.doesNotMatch(deployScript, /drain-storefront-cache-invalidations/);
assert.doesNotMatch(deployScript, /storefront-cache-transition\.service/);
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter web exec vitest run src/lib/events/event-pipeline-database.test.ts src/lib/events/event-pipeline-boundary-manifest.test.ts src/lib/events/storefront-cache-transition-boundary.test.ts src/env.test.ts && node --test vps-workers/jobs/deploy-crontab.test.mjs`

Expected: FAIL until finite receipts/current-service configuration exist.

- [ ] **Step 3: Implement authority/deployment and prove rollout**

Now that the migration-generated types and all runtime sources exist, add the three typed RPC names, exact caller map, signatures, production roots, and actuator closure receipt. Split database evidence explicitly: `productionHistoryFunctionNames` remains the existing frozen 19-name list and alone filters/asserts `tools/db/fixtures/production-history-effects.json`; `storefrontCacheTransitionLocalFunctionNames` is the exact three-name list proved by Task 1's executable isolated-replay catalog contract; and their sorted union must equal the full 22-name `EVENT_PIPELINE_FUNCTION_NAMES`. Do not change `supabase-history-effects.sql`, `supabase-history-effect-scope.ts`, `supabase-history-effect-query-contract.ts`, the fixed 19-function production assertion/digest vector, or `production-history-effects.json` before a real post-deploy attestation. Re-run the Task 1 isolated replay command so the full 22-name types/signatures and local catalog contract are proven together.

Allow exact specialized RPCs only from existing worker modules; preserve analytics receipts and keep every `EVENT_PIPELINE_BOUNDARY.authority.*` array byte-identical. Worker config requires HTTPS `STOREFRONT_CACHE_ACTUATOR_URL` plus `STOREFRONT_CACHE_ACTUATOR_SECRET`; Vercel config requires that secret plus `STOREFRONT_CACHE_CANARY_MERCHANT_ID`. The actuator reconstructs only fixed `ogabassey` identity after signed `merchantId` equals that configured UUID, and its hostname builder must return exactly sorted `ogabassey.com,www.ogabassey.com` or fail. The worker receives no Cloudflare token. Do not add service/schedule. Migration must deploy before prebuilt web/VPS artifacts. Before enqueue: prove capable router/delivery heartbeats, stale-router defer/no-dead-letter, queue-age alert, load/poison latency, production presence of Cloudflare env values without logging them, and DB canary UUID equality with Vercel configured UUID without logging either value. Keep actuator disabled until all preflights succeed.

Run: `pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test && pnpm --filter web exec vitest run tools/events/verify-event-pipeline-boundaries.live.test.ts && supabase test db --file supabase/tests/domain_event_ingress_pipeline.sql && supabase test db --file supabase/tests/event_delivery_pipeline.sql && supabase test db --file supabase/tests/storefront_cache_transition.sql`

Expected: PASS; deploy all flags false, stage one database canary, drill atomic rollback/crashes/DLQ/replay, then observe one production merchant/category for 48 hours. Roll back enqueue, routing, delivery; preserve every canonical record and repair forward append-only.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/events/event-pipeline-database.ts apps/web/src/lib/events/event-pipeline-database.test.ts apps/web/src/lib/events/event-pipeline-boundary-manifest.ts apps/web/src/lib/events/event-pipeline-boundary-manifest.test.ts apps/web/src/env.ts apps/web/src/env.test.ts vps-workers/install-event-pipeline-services.sh vps-workers/deploy.sh vps-workers/jobs/deploy-crontab.test.mjs docs/ops/durable-event-pipeline.md
git commit -m "docs: gate cache transition canary rollout"
```

## Required implementation detail addendum

### Trigger ordering and semantic snapshot

`capture_category_cache_transition_v1()` must be an `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW` trigger. It consumes `TG_OP`, `OLD`, and `NEW`; delete uses `OLD` directly and never performs a post-delete category-ID lookup. The trigger fires only for:

- INSERT;
- DELETE;
- UPDATE where `slug`, `name`, `is_active`, `parent_id`, or the merchant/category ownership key is `IS DISTINCT FROM` its old value.

PostgreSQL does not support `FOLLOWS`. The migration must inspect and preserve the existing `categories_hierarchy_before_write` and `categories_lifecycle_after_update` logic from `20260726103000_atomic_category_hierarchy_lifecycle.sql`. Use a single new AFTER trigger whose body receives final `OLD`/`NEW` and, for lifecycle updates, reads the tombstone/child-promotion rows already materialized by the existing AFTER trigger under the same transaction; name it lexically after `categories_lifecycle_after_update` only where PostgreSQL’s same-timing name ordering is the deployed behavior, and prove order with an executable SQL assertion against `pg_trigger`. The test suite must cover insert, rename, deactivate, reactivate, delete, child promotion, direct SQL, no-op update, and rollback. The transition payload is a database-derived final semantic snapshot; no request input enters it.

### Physical SQL invariants and RPC signatures

The migration must enforce these constraints, indexes, and fences:

```sql
CREATE UNIQUE INDEX storefront_cache_transition_one_pending_tail
  ON public.storefront_cache_transition_obligations (merchant_id, category_id)
  WHERE status = 'pending';
CREATE UNIQUE INDEX storefront_cache_transition_one_pending_successor
  ON public.storefront_cache_transition_obligations (successor_of)
  WHERE status = 'pending';
ALTER TABLE public.storefront_cache_transition_obligations
  ADD CONSTRAINT storefront_cache_transition_no_self_successor
  CHECK (successor_of IS NULL OR successor_of <> id);
```

The successor insert function must lock the chain root and reject a successor whose recursive ancestry reaches itself; database tests must prove no cycle. Claimed rows keep immutable `generation` and payload. The cache-claim query joins predecessor state and refuses a pending successor until its predecessor delivery is terminal; it then claims the tail. SQL tests prove claimed parent plus pending successor succeeds, a second pending tail fails, successor claim blocks before parent terminal, and succeeds afterwards. Every terminal update predicates on `(delivery_id, claim_token, obligation_id, generation, status='claimed')`.

Exact RPCs are:

```sql
route_storefront_cache_transition_v1(
  p_queue_message_id bigint, p_domain_event_id uuid, p_worker_id text
) returns boolean;
claim_storefront_cache_transition_deliveries_v1(
  p_batch_size integer, p_worker_id text, p_lease_seconds integer, p_deadline_seconds integer
) returns table(id uuid, domain_event_id uuid, claim_token uuid, attempt_number integer, obligation_id uuid, generation bigint, payload jsonb);
finish_storefront_cache_transition_delivery_v1(
  p_delivery_id uuid, p_claim_token uuid, p_obligation_id uuid, p_generation bigint, p_receipt jsonb,
  p_outcome text, p_available_at timestamptz, p_error_code text, p_error_message text, p_http_status integer
) returns boolean;
```

Generic `claim_event_deliveries_v1` excludes `storefront_cache_transition`; the cache claim includes only it. Lease is 90 seconds, actuator full-barrier deadline 60 seconds, and atomic terminal fence is `(delivery_id, claim_token, obligation_id, generation, status='claimed')`. Retryable outcomes use existing exponential backoff. A timeout, network failure, missing receipt, or invalid/mismatched receipt is cache-specific retryable because every barrier operation is idempotent; only an exact request-bound typed receipt may complete the delivery. A retry reruns the whole barrier rather than resuming an invented per-stage checkpoint.

### Contract, schema, and worker wiring inventory

Contract ownership is split only where generated types or real source paths require it:

- `apps/web/src/lib/events/event-contract.ts` and its tests for `storefront.cache_transition.v1`;
- `apps/web/src/lib/events/event-route-destination.ts`, route resolution, active-destination config, and their tests for `storefront_cache_transition`;
- `apps/web/src/schemas/claimed-event-delivery-schema.ts` and its tests for obligation ID/generation;
- `apps/web/src/lib/events/event-pipeline-database.ts`, its exhaustive RPC/caller/signature/hash tests, and `apps/web/src/lib/events/event-pipeline-boundary-manifest.ts` are owned by Task 5 after the migration-generated types and all callers exist;
- `apps/web/src/lib/domain-event-pipeline-migration.test.ts`, migration replay list, public-RPC inventory, and expected pending-source fixture;
- `supabase/tests/domain_event_ingress_pipeline.sql`, `supabase/tests/event_delivery_pipeline.sql`, and `supabase/tests/storefront_cache_transition.sql`;
- generated `apps/web/src/types/supabase.ts`, refreshed with the repository’s checked-in Supabase type generation command before its type test runs.

`process-domain-events.ts` must run the capable-router branch inside the existing loop and record `storefront-cache-router` heartbeat. `process-event-deliveries.ts` must reserve one just-in-time cache slot when cache work is available, cap cache concurrency at one, then fill remaining capacity with analytics claims; `--once` drains one bounded cache batch and then exits. It records `storefront-cache-delivery` heartbeat separately. Existing systemd units, wrappers, deployment script, Turbo pipeline, and one-minute recovery sweeps remain unchanged; add only their configuration tests.

### Reused publication-cache hostname boundary

Do not create a new hostname builder. Reuse `buildStorefrontPublicationPurgeHostnames` and its tests. Add actuator tests proving exact signed canary identity/slugs, real primitive order, typed success only, and fail-closed unknown/mismatched merchant, non-Vercel runtime, false product invalidation, or `not_running_on_vercel`. The existing builder’s approved result is `ogabassey.com` plus `www.ogabassey.com`; arbitrary aliases, domains, and payload hosts never reach Cloudflare. This fixed canary purges all storefront documents on those aliases because shared navigation makes selective URL purge correctness-incomplete.

### Self-review and governance gate

| Requirement | Plan coverage |
|---|---|
| Owner authority ceiling and finite importers | Task 0 approval record; Task 5 executable receipts |
| Atomic category producer and trigger lifecycle | Tasks 1–2 plus trigger addendum |
| Canonical PGMQ ingress and bounded stale-router risk | Task 2 |
| One destination, claims, generation fence, retry/DLQ/replay | Task 4 plus SQL addendum |
| Actuator isolation and Next/Vercel ordering | Task 3 |
| Strict approved-hostname Cloudflare barrier | Task 3/4 plus reused publication boundary |
| Existing worker fairness, flags, heartbeats, no scheduler | addendum and Task 5 |
| Deployment, canary, rollback, analytics parity | Task 5 |

Before each commit run its focused test command. Before review run `pnpm turbo lint`, `pnpm turbo typecheck`, `pnpm turbo test`, every listed SQL file, and `git diff --check`. Run `coderabbit review --agent -t uncommitted`; fix critical/high findings, rerun affected tests, then perform the repository exact-head review/required-check gate before merge. No production deployment occurs without the owner-approved VPS prebuilt workflow and the migration-first gate.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-27-b0-durable-cache-invalidation-on-3077.md`. Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - execute tasks in this session using executing-plans, batch execution with checkpoints.
