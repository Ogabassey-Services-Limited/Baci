# Durable Event Pipeline Implementation Plan

**Status:** Implemented behind fail-closed feature flags after repeated adversarial rereview against current `origin/main` and live read-only capability evidence. The code is not deployed and every producer/destination remains disabled by default.
**Scope:** Selective change data capture, centralized event routing, retry handling, dead-letter operations, and migration of the existing analytics fan-out.
**Out of scope:** Replacing every webhook or queue in Baci, changing payment state machines, implementing cache invalidation or search indexing, editing existing migrations, or introducing Kafka/Debezium in the first release.

### Implementation outcome

This branch now contains:

- a strict shared V1 event contract with distinct internal and external IDs;
- logged PGMQ ingress, atomic producer RPCs, trust-aware routing, independent destination claims, retries, ambiguous-outcome state, DLQs, immutable replay audit, heartbeats, and bounded retention;
- disabled-by-default CDC for allowlisted product/order/transaction fields;
- durable analytics, platform-event, and paid-order producers with the legacy fan-out retained behind a fail-safe cutover gate;
- authenticated platform-admin read/replay RPCs that do not expose service-role credentials or direct queue/table access;
- installable always-on VPS workers plus one-minute `flock` recovery sweeps;
- migration-contract, unit, worker, and transactional SQL lifecycle tests.

Local PostgreSQL 17.6 current-schema compatibility and the new migration chain pass. A full clean repository rebuild is currently blocked earlier by the pre-existing invalid syntax in `20260525140048_quiz_authoritative_answer_scoring.sql`; this branch does not edit that applied migration. The blocker must be repaired through the repository's baseline/migration-repair process before clean-reset CI can be treated as a launch gate.

## 1. Current State

Baci already has pieces of an event system, but not a durable end-to-end pipeline:

- `apps/web/src/app/api/events/route.ts` accepts web and mobile analytics events, writes `analytics_events`, and invokes ad-platform fan-out in `after()`.
- `apps/web/src/lib/analytics/send-to-ad-platforms.ts` normalizes conversion names and routes supported events to Meta, TikTok, and Snapchat.
- `apps/web/src/app/api/platform/events/route.ts` separately writes `platform_events` and performs detached external forwarding.
- `supabase/migrations/20260510120000_payment_side_effects.sql` is a payment-specific claim/retry outbox. It is a useful concurrency pattern, but it is not a general event bus and has no terminal dead-letter state.
- `vps-workers/` is the established durable scheduling environment. Web cron routes remain available for work that requires the Next.js runtime.

The current analytics path can lose an outbound delivery after the database insert succeeds. Failures are logged, but there is no durable retry record, destination-specific delivery state, DLQ, or replay workflow.

## 2. Research Decision

### Selected substrate: Supabase Queues (`pgmq`)

Use a **logged** Supabase Queue as the durable ingress queue. Supabase Queues is Postgres-native, supports visibility timeouts, increments `read_ct` on every read, retains messages until explicit deletion or archival, and exposes queue-age metrics. This matches Baci's existing Supabase and VPS operating model without adding a new broker.

Live read-only verification on 2026-07-12 found PostgreSQL `17.6`, `pgmq` available at Supabase-supported version `1.5.1` but not yet installed, and `pg_net 0.19.5` installed. PGMQ `1.5.1` includes `create`, `send`, `read`, `read_with_poll`, `archive`, and `metrics`, so the implementation pins itself to that proven function surface rather than relying on newer upstream-only APIs.

PostgreSQL 18.4 is the latest upstream release, but Supabase's current hosted upgrade path is PostgreSQL 17.10. Baci must first upgrade 17.6 to the current Supabase-supported 17.10 patch level in a separately approved maintenance window. Do not force PG18 through local configuration or self-managed binaries while the hosted project does not offer that target.

Do not use an unlogged queue. Durability is the purpose of this work.

### Selected capture model: selective transactional triggers

Use small `AFTER INSERT OR UPDATE OR DELETE` triggers only on an approved table/column allowlist. Each trigger builds a versioned event envelope and calls `pgmq.send()` in the same database transaction as the row mutation. If the mutation rolls back, the queue write rolls back too.

Once a producer is enabled, enqueue failure intentionally aborts the source mutation. Failing open would silently lose CDC events and violate the outbox contract, so producer enablement requires successful queue-availability and mutation-latency drills first.

This is selective application-level CDC, not unrestricted WAL streaming. Do not introduce logical replication slots or Debezium in this phase: they add slot/WAL operations, duplicate-delivery handling, an external consumer runtime, and a much larger PII surface. Revisit WAL-based CDC only if Baci later needs a complete database stream or external warehouse replication.

### Rejected durability mechanism: Database Webhooks / `pg_net`

Supabase Database Webhooks are asynchronous trigger wrappers around `pg_net`, but `pg_net` request/response tables are unlogged and responses are short-lived by default. They are useful as wake-up hints, not as the source of truth for guaranteed delivery.

### Worker model

Use an always-on VPS `systemd` worker as the primary consumer. It uses `pgmq.read_with_poll()` with a visibility timeout, validates and routes each event, then archives the ingress message only after routing state is durably recorded. A one-minute, `flock`-guarded cron sweep provides recovery if the service is stopped or unhealthy. An optional signed wake-up request is unnecessary while long polling is healthy and must never be part of the correctness contract.

Do not use Next.js `after()` for durable delivery. It remains acceptable for a best-effort wake-up after a successful enqueue.

## 3. Target Architecture

```text
Client/API mutation or direct Supabase write
                  |
                  v
        Postgres row mutation
                  |
       same transaction (trigger/RPC)
                  v
       domain_event_ledger + pgmq domain_events
                  |
          VPS event router
                  |
       validate + resolve routes
                  |
          event_deliveries
       /          |           \
    Meta       TikTok      Snapchat / future targets
       \          |           /
        success, retry, or dead_letter
                  |
          operator replay/audit
```

`domain_event_ledger` provides producer deduplication and the canonical internal event identity. The queue guarantees durable ingress. `event_deliveries` provides destination-level idempotency, independent retries, operational visibility, and DLQ state. `domain_event_failures` records malformed or unroutable ingress events separately from destination failures.

## 4. Canonical Event Contract

Add a shared Zod contract in `packages/shared/src/contracts/domain-event.ts` and colocated tests.

Required envelope fields:

```typescript
type DomainEventV1 = {
  schema_version: 1;
  domain_event_id: string; // UUID generated and owned by Baci
  external_event_id?: string; // Provider/client dedupe ID; not assumed to be UUID
  event_name: string;
  occurred_at: string;
  producer: 'database' | 'web' | 'mobile' | 'worker';
  trust_level: 'anonymous_client' | 'tenant_verified_client' | 'authenticated_client' | 'server' | 'database';
  source: {
    schema?: string;
    table?: string;
    operation?: 'INSERT' | 'UPDATE' | 'DELETE';
  };
  subject: {
    type: string;
    id: string;
  };
  merchant_id?: string;
  correlation_id?: string;
  causation_id?: string;
  idempotency_key: string; // Unique with producer in the event ledger
  changed_fields?: string[];
  data: Record<string, unknown>;
  metadata: {
    environment: string;
    request_id?: string;
    shadow_only?: boolean;
  };
};
```

Contract rules:

- Event names are versioned dotted names, for example `catalog.product.updated.v1`, `commerce.order.paid.v1`, and `analytics.begin_checkout.v1`.
- The schema version is mandatory and immutable.
- `trust_level` is assigned by the server/RPC, never accepted from the request body. `tenant_verified_client` means the body merchant matched a trusted host/proxy context; it does not claim user authentication. High-value events such as paid orders and purchases route to server-side conversion destinations only when produced by an approved `server` or `database` producer.
- Producers include only allowlisted fields. Never serialize `NEW` or `OLD` wholesale.
- Passwords, tokens, payment credentials, full addresses, and raw webhook payloads are forbidden.
- Email and phone are omitted unless a destination explicitly requires them. When required, resolve them at delivery time from an authorized server-side source rather than copying them into the queue.
- `domain_event_id` is an internal UUID. It is never substituted for a client/provider event ID.
- `external_event_id` preserves the existing string identifier used for browser-pixel and server-CAPI deduplication.
- `idempotency_key` is deterministic for database events and enforced by a unique `(producer, idempotency_key)` constraint. Do not rely on timestamps alone. Use an immutable source version such as an order status-history ID, transaction row version, product revision, or an explicit API event ID. If a source has no safe version, add one before enabling its trigger.
- Consumers must be idempotent even when the queue redelivers a message.

## 5. Database Design

Create an ordered, append-only migration set with each file under the repository's 300-line ceiling. The implementation separates tables, internal authorization, producer RPCs, reads, routing, replay, claims, heartbeats, admin operations, CDC, and retention so each contract can be reviewed independently.

The migration must:

1. Preserve the recorded production capability evidence above and verify staging/local/CI compatibility. The migration must still fail closed if `pgmq` cannot be enabled.
2. `CREATE EXTENSION IF NOT EXISTS pgmq` using the exact Supabase-supported form proven in staging.
3. Create logged queues:
   - `domain_events` — durable ingress.
4. Create `public.domain_event_ledger` as the canonical deduplication and audit row:
   - `domain_event_id uuid primary key default gen_random_uuid()`
   - `producer text not null`
   - `trust_level text not null check (trust_level in ('anonymous_client','tenant_verified_client','authenticated_client','server','database'))`
   - `idempotency_key text not null`
   - `external_event_id text`
   - `event_name text not null`, `schema_version integer not null`
   - `subject_type text not null`, `subject_id text not null`
   - `merchant_id uuid`
   - `envelope jsonb not null`
   - `queue_message_id bigint`
   - `status text not null default 'queued' check (status in ('queued','routed','no_route','ingress_dead_letter'))`
   - `created_at timestamptz not null default now()`, `routed_at timestamptz`
   - unique `(producer, idempotency_key)`.
5. Create `public.domain_event_failures` for ingress failures. The original envelope and failure identity are immutable; replay metadata may be updated only by the replay RPC:
   - `id uuid primary key default gen_random_uuid()`
   - `domain_event_id uuid references public.domain_event_ledger(domain_event_id)` when parsing reached the ledger
   - `queue_message_id bigint not null`
   - `original_envelope jsonb not null`
   - `failure_code text not null`, `failure_message text not null`
   - `parser_version integer`, `event_name text`, `merchant_id uuid`
   - `first_failed_at`, `last_failed_at` as non-null `timestamptz`
   - `replay_count integer not null default 0 check (replay_count >= 0)`
   - `replayed_by uuid`, `replayed_at timestamptz`, `replay_reason text`
   - unique `(queue_message_id)` so a poison message cannot create repeated failure rows.
6. Create `public.event_deliveries`:
   - `id uuid primary key`
   - `domain_event_id uuid not null references public.domain_event_ledger(domain_event_id) on delete restrict`
   - `destination text not null`
   - `status text not null default 'pending' check (status in ('pending','claimed','retry','shadowed','skipped','delivery_unknown','delivered','dead_letter'))`
   - `attempts integer not null default 0 check (attempts >= 0)`
   - `replay_count integer not null default 0 check (replay_count >= 0)`
   - `available_at timestamptz not null default now()`
   - `claim_token uuid`, `claimed_at timestamptz`, `claimed_by text`
   - `last_error_code text`, `last_error_message text`
   - `last_http_status integer`, `provider_response_id text`
   - `payload jsonb not null`
   - `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`, `shadowed_at timestamptz`, `delivered_at timestamptz`, `dead_lettered_at timestamptz`
   - unique `(domain_event_id, destination)` to make router replay harmless.
7. Create `public.event_delivery_attempts` as an append-only bounded audit ledger with `delivery_id` referencing `event_deliveries(id) on delete restrict`, `attempt_number integer not null`, timestamps, outcome, duration, HTTP status, safe error details, and worker ID. Add unique `(delivery_id, attempt_number)`. Do not store provider secrets or full sensitive responses.
8. Enable and force RLS on every service-only event table; revoke access from `PUBLIC`, `anon`, and `authenticated`; grant only the minimum service-role reads required for operations. Queue access stays behind Baci-owned wrappers.
9. Add indexes that exactly match worker and operations queries:
   - `(available_at, created_at)` where status in `('pending','retry')`.
   - `(claimed_at)` where status = `'claimed'` for lease recovery.
   - `(domain_event_id, destination)` unique.
   - `(destination, created_at desc)`.
   - `(dead_lettered_at desc)` where status is `dead_letter`.
   - `(failure_code, first_failed_at desc)` on ingress failures.
10. Add `SECURITY DEFINER` RPCs with empty search paths, fully qualified objects, fixed statement timeouts, and explicit role guards. One claim-token-guarded finish RPC owns all delivery outcomes so state and attempt audit cannot diverge:
   - `enqueue_domain_event_v1(...)`
   - `route_domain_event_v1(queue_message_id, domain_event_id, destinations, shadow, active_destinations)`
   - `dead_letter_ingress_event_v1(...)`
   - `claim_event_deliveries_v1(batch_size, worker_id, lease_seconds)`
   - `finish_event_delivery_v1(...)`
   - `replay_ingress_dead_letter_v1(...)`
   - `replay_event_delivery_v1(...)`
11. Revoke RPC execution from public roles and grant only `service_role`, except authenticated platform-admin list/replay RPCs that re-check `auth.uid()` and `is_platform_admin` inside the database. Browser roles receive no direct table or PGMQ grants.

Do not expose `pgmq_public` to browser clients. Application producers enqueue through Baci-owned RPCs or database triggers.

### Atomic producer contract

`enqueue_domain_event_v1` must perform these operations in one short transaction:

1. Insert `domain_event_ledger` with `ON CONFLICT (producer, idempotency_key) DO NOTHING`.
2. If the insert loses, return the existing `domain_event_id` and `already_enqueued = true`; do not send another queue message.
   First compare immutable identity and event data; fail with `domain_event_idempotency_conflict` when a key was reused for different semantics.
3. If it wins, build the canonical envelope with the generated `domain_event_id`, call `pgmq.send('domain_events', envelope)`, and persist the returned `queue_message_id`.
4. Return only after the ledger and queue write commit.

No external network call may occur inside this transaction.

### Claim and routing contract

- The delivery claim RPC uses an atomic `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)` and returns the claimed rows.
- A route RPC receives the ingress queue message ID, canonical `domain_event_id`, and validated destination list. It inserts all deliveries with `ON CONFLICT DO NOTHING`, marks the ledger routed/no-route, and archives the exact PGMQ message in the same transaction.
- The route RPC locks the `domain_event_ledger` row and verifies that its persisted `queue_message_id` equals the supplied message ID before archiving; it must not depend on direct reads from PGMQ's internal queue tables or archive an unrelated message.
- `dead_letter_ingress_event_v1` atomically inserts/updates the ingress failure ledger, marks the event ledger when present, and archives the exact poison message.
- Completion, retry, unknown, dead-letter, and replay transitions are guarded by `claim_token` and the expected current status. Stale workers update zero rows.
- Ingress replay keeps the original envelope immutable, appends an operator/reason/new-queue-ID audit row, updates the ledger to `queued`, sends a new PGMQ message, and replaces `queue_message_id` in one transaction. The replayed message then re-enters the current parser/router. It never changes `domain_event_id` or `idempotency_key`.
- Destination replay retains the original payload and provider event ID, creates the next audited attempt number, and transitions only `dead_letter` or operator-resolved `delivery_unknown` rows back to `retry`.

## 6. Change Data Capture

### Phase-one table allowlist

Start with low-risk, high-value events:

| Table/source | Events | Capture rule |
|---|---|---|
| `products` | `catalog.product.created`, `.updated`, `.deleted` | Emit only when storefront-relevant allowlisted columns change. Include IDs/slugs and changed field names, not full descriptions or credentials. |
| `orders` | `commerce.order.status_changed`, `.paid`, `.cancelled` | Emit only on relevant status transitions. Do not replace payment-side-effect processing. |
| `transactions` | `payments.transaction.status_changed` | Observation/reconciliation event only; no money-moving consumer in phase one. |
| `/api/events` | normalized `analytics.*` events | Explicit producer RPC, not a row trigger, to avoid recursively capturing `analytics_events`. |
| `/api/platform/events` | normalized `platform.*` events | Explicit producer RPC. |

Trigger requirements:

- One trigger function per bounded domain or one carefully parameterized helper; keep each implementation under 300 lines.
- Use `WHEN` clauses or explicit `IS DISTINCT FROM` comparisons so irrelevant updates do not enqueue messages.
- For deletes, emit a tombstone containing only safe identity/routing fields.
- Use `pg_trigger_depth()` or table exclusion guards to prevent recursion.
- Add migration-contract tests that assert trigger coverage, allowed columns, grants, RLS, and rollback behavior.
- Benchmark bulk updates before enabling product triggers in production. Define a hard mutation-latency and queue-volume budget in Phase 0. If row-level volume exceeds it, stop the rollout and design a separately versioned batch envelope using statement-level transition tables; do not silently put multiple subjects into the single-subject V1 contract.
- Orders and transactions stay observation-only until a separate payment-security review approves every consumer. Their events must never trigger money movement or replace `payment_side_effects`.

## 7. Event Routing

Add routing modules under `apps/web/src/lib/events/`:

- `event-contract.ts` — re-export shared contract and server parsing helpers.
- `event-route-registry.ts` — pure mapping from event name/version to destinations.
- `event-destination.ts` — destination interface and result types.
- `event-redaction.ts` — final payload allowlisting/redaction per destination.
- `event-error-classification.ts` — permanent versus retryable failures.

The registry must be declarative, exhaustive, version-aware, and trust-aware. Example:

```typescript
const EVENT_ROUTES = {
  'analytics.purchase.completed.v1': {
    allowedProducers: ['worker', 'database'],
    allowedTrust: ['server', 'database'],
    destinations: ['facebook', 'tiktok', 'ga4', 'snapchat'],
  },
  'analytics.begin_checkout.v1': {
    allowedProducers: ['web', 'mobile'],
    allowedTrust: ['tenant_verified_client', 'authenticated_client'],
    destinations: ['facebook', 'tiktok', 'snapchat'],
  },
} satisfies EventRouteRegistry;
```

Routing rules:

- Unknown schema versions go directly to the ingress DLQ with `unsupported_schema_version`.
- Valid but intentionally unrouted events are archived as `no_route`; they are not failures.
- Unknown event names go to the ingress DLQ unless explicitly allowed as `no_route`.
- A known event from an unapproved producer/trust level is dead-lettered as `producer_not_authorized_for_event`; it is never downgraded into a trusted event.
- Route resolution inserts all `event_deliveries`, marks the ledger, and archives the exact ingress message in one RPC transaction.
- A replayed ingress message cannot duplicate deliveries because of unique `(domain_event_id, destination)`.
- Destination adapters remain independent; one provider failure cannot block another provider.
- Shadow routing creates terminal `shadowed` delivery rows that are excluded from claim queries. Old shadow rows are never promoted or sent at cutover; only events routed after a destination flag becomes active receive `pending` deliveries.
- Active routing is fail-closed twice: a destination must be in `EVENT_PIPELINE_ACTIVE_DESTINATIONS`, and the event merchant must be in `EVENT_PIPELINE_CANARY_MERCHANT_IDS` (or the explicit `*` full-rollout value). Non-canary destinations remain terminal shadow rows for parity evidence.
- Replace direct calls from `/api/events` and `/api/analytics/conversion` with enqueueing only after shadow validation proves parity.

### Boundary with cache invalidation and search

This plan does not implement `cache_invalidation` or `search_index` destinations. The B0 durable cache-invalidation ADR currently owns cache freshness because its consumer must run inside Next.js to invalidate the Next Data Cache before purging Cloudflare. Product CDC may be observed, but it must not drive cache invalidation until the B0 design is explicitly reconciled or superseded. Search indexing requires its own consumer contract and rollout review.

## 8. Worker and Retry Semantics

Add:

- `apps/web/src/scripts/process-domain-events.ts` — long-polls, validates, and routes ingress messages.
- `apps/web/src/scripts/process-event-deliveries.ts` — continuously claims and executes destination deliveries.
- `vps-workers/bin/process-domain-events.sh` and `process-event-deliveries.sh` — repo-backed wrappers using the existing `/opt/baci/app` checkout pattern.
- two restart-on-failure user `systemd` services installed by `vps-workers/deploy.sh`.
- matching one-minute, `flock`-guarded recovery sweeps and deployment tests in `vps-workers/deploy.sh`.

Suggested initial settings, configurable by environment:

- Ingress batch: 100.
- Delivery claim batch: at most 25 and no more than two configured concurrency waves (10 at the initial concurrency of 5), preserving lease margin.
- Delivery concurrency: 5, configurable and clamped to 1–10.
- Active destinations: empty by default; explicitly allowlisted per destination.
- Canary merchants: empty by default; explicit UUIDs, with `*` reserved for approved full rollout.
- Long-poll window: 5 seconds.
- Visibility/claim lease: 60 seconds, greater than the bounded provider timeout.
- Provider request timeout: 10 seconds.
- Maximum attempts: 8.
- Maximum ingress reads before poison-message dead-letter: 5, clamped to 2–20.
- Healthy heartbeat interval: 30 seconds, with immediate activity/failure updates and a 5-second worker error backoff.
- Exponential retry schedule with jitter: approximately 30s, 2m, 10m, 30m, 2h, 6h, 12h, 24h.

Classification:

- Retry: pre-send timeout, network error, `408`, `425`, `429`, and `5xx`. Use bounded exponential jitter now; add typed `Retry-After` propagation when the provider adapters expose response headers.
- Permanent failure: malformed destination payload, unsupported event/version, missing required immutable data, and most `4xx` responses after configuration is confirmed.
- Configuration failures such as missing/invalid merchant credentials should dead-letter with an actionable code rather than retry forever.
- Never retry money movement through this generic pipeline. Payment state transitions remain under their existing idempotent payment workflows.
- A timeout or disconnect after request bytes may have reached a provider is `delivery_unknown`, not automatically retryable. Retry it only when that provider's deduplication contract has been verified and the same provider event ID is reused.

Each completion/retry/dead-letter transition must be claim-token guarded. A stale worker must not overwrite a newer attempt.

When a stale claim is recovered, the claim RPC first appends a `lease_expired` attempt row for the abandoned worker before issuing a new token and incrementing the attempt number. Provider calls run with bounded concurrency and at most two claimed waves, preserving margin inside the lease.

### Destination idempotency matrix

Before enabling any destination, document and test:

| Destination | Stable key | Ambiguous-outcome policy | Launch gate |
|---|---|---|---|
| Meta CAPI | Existing `external_event_id`/`event_id` reused on every attempt | Retry only after proving Meta deduplicates the browser/server and worker retry shapes in use | Shadow comparison plus crash-after-provider-success test |
| TikTok Events API | Stable provider event ID supported by the active adapter | `delivery_unknown` until deduplication is proven against current API behavior | Same-ID replay test in sandbox/test events |
| Snapchat CAPI | Stable provider event ID if supported by the active adapter | `delivery_unknown` when provider acceptance cannot be determined | Provider-specific duplicate test or manual reconciliation rule |
| GA4 Measurement Protocol | Stable client/event parameters where supported; no assumed universal idempotency | Do not blindly retry ambiguous sends; classify and document acceptable analytics duplication risk | Explicit product-owner acceptance and test |

Provider claims must be verified against current official documentation and a test endpoint immediately before implementation. The generic worker must not pretend all destinations have the same deduplication guarantees.

## 9. Dead-Letter Handling

Dead-letter is a first-class state, not merely a log line.

An item enters a DLQ when:

- its envelope is invalid or unsupported;
- routing cannot safely determine a destination;
- a destination classifies the error as permanent; or
- `attempts >= max_attempts`.

Ingress and destination failures are deliberately separate:

- Invalid, unsupported, or unroutable ingress messages are archived from PGMQ and recorded in `domain_event_failures`.
- Destination failures remain in `event_deliveries` with `status = 'dead_letter'` and retain their immutable source payload plus attempt history.
- Ambiguous external outcomes use `delivery_unknown`, not `dead_letter`, until reconciled or explicitly resolved by an operator.

Required operations:

- Read-only admin/ops endpoint to list DLQ counts, age, destination, event name, merchant, and safe error summary.
- Separate filters and counters for ingress failures, destination dead letters, and unknown deliveries.
- Single-item replay RPC with an operator-supplied reason.
- Batch replay capped at 100 items and filtered by destination/error code/time window.
- Replay resets claim fields, increments `replay_count`, records `replayed_by`, `replayed_at`, and creates an audit attempt.
- Payload correction is not allowed during replay. If the contract or routing logic was fixed, replay the immutable original event through the current parser/router. If source data was wrong, emit a new corrective event linked by `causation_id`.
- Retain delivered attempt logs for 30 days and dead-letter records for at least 90 days initially; revisit after measuring volume and compliance needs.
- Delete at most 10,000 successful attempt rows and 10,000 duplicated PGMQ archive rows per retention sweep; keep the canonical ledger and unresolved failures intact.
- These operations, alerts, and a successful staging replay drill are launch prerequisites for Phase 3, not post-cutover hardening.

## 10. API Migration

### Ingress trust boundary

- Request bodies may provide event facts but never `trust_level`, destinations, retry policy, or provider credentials.
- Resolve the merchant from trusted host/domain context and compare it with any body merchant ID; reject mismatches. Do not let an anonymous caller select another merchant by UUID.
- Apply the existing proxy rate-limit boundary plus route-specific event-size, batch-size, event-name, timestamp-skew, and payload-shape limits.
- Separate client-observed events from server-confirmed business events. Anonymous/mobile `purchase` claims may be stored for telemetry if desired but cannot route server-side purchase conversions.
- Server-confirmed purchase events originate from the existing paid-order/payment-side-effect boundary with the existing order and transaction idempotency guarantees.
- Reject unknown top-level properties through strict Zod schemas and retain only destination-specific allowlisted fields.
- Stamp request/correlation metadata server-side and never persist raw authorization headers, cookies, IP addresses, or full user agents in the domain envelope.
- Treat host/merchant agreement as `tenant_verified_client`, not as proof that a user is authenticated.

### `/api/events`

1. Move request validation to a colocated Zod schema under `apps/web/src/schemas/`.
2. Preserve a supplied client/provider ID as `external_event_id`; generate one stable text ID when absent. The enqueue RPC separately creates `domain_event_id` as a UUID.
3. Use one database RPC to insert/deduplicate `analytics_events`, insert/deduplicate `domain_event_ledger`, and enqueue the domain event atomically. A duplicate external event must return the original IDs without sending a second queue message.
4. Return success only after both durable writes commit.
5. Remove `sendToAdPlatforms()` from `after()` after shadow mode passes.
6. Keep a best-effort signed worker wake-up only as a latency optimization.

### `/api/analytics/conversion`

1. Reuse the same schema, normalization, and enqueue helper.
2. Preserve client/server event IDs as `external_event_id` for pixel deduplication; never cast them to UUID.
3. Stop maintaining a second independent local-logging/fan-out path.
4. During migration, dual-write to the queue but disable worker delivery (`shadow` destination) and compare route decisions before cutover.

### `/api/platform/events`

1. Add Zod validation and a strict event allowlist.
2. Generate a stable external ID, then insert/deduplicate `platform_events` and enqueue atomically through an RPC.
3. Move GA4/Meta forwarding to destination adapters and remove detached `.catch()` forwarding after parity validation.

### Paid-order conversion producer

1. Treat `apps/web/src/lib/payments/paid-order-ad-tracking-executor.ts` as the authoritative server-confirmed purchase producer; anonymous analytics routes cannot substitute for it.
2. Replace its scheduled direct conversion call with a service-role enqueue using an idempotency key derived from the paid order and the existing `ad_tracking_conversion` side-effect step.
3. Mark the payment side-effect step complete only after durable enqueue commits. Provider delivery then belongs to the generic delivery ledger and must not hold or retry the payment transaction itself.
4. Queue only order/merchant identifiers and safe conversion facts. Resolve email/phone and destination credentials just-in-time through authorized server-side reads, then apply destination redaction/hashing.
5. Preserve the existing external event ID across browser pixel, durable event, and every provider attempt.

## 11. Observability and Operations

Emit structured metrics/logs without event payloads:

- ingress queue depth and oldest-message age;
- routed events per event name/version;
- open deliveries by destination/status;
- delivery latency p50/p95/p99;
- retry and DLQ rates by destination/error code;
- stale claims recovered;
- deduplication conflicts;
- replay count and replay success rate.
- router and delivery-worker heartbeat, restart count, and last successful batch time;
- enqueue-to-first-attempt latency, with a Phase-3 launch target of p95 under 10 seconds for conversion events.

Alert thresholds for the initial rollout:

- oldest ingress message > 5 minutes;
- oldest open delivery > 15 minutes for conversion events;
- any DLQ growth for payment/commerce transition events;
- destination failure rate > 5% over 15 minutes with at least 20 attempts;
- stale claims continuously recovered for 10 minutes;
- worker has not completed a sweep in 5 minutes.
- always-on worker heartbeat missing for 60 seconds or repeated `systemd` restarts.

Add a runbook at `docs/ops/durable-event-pipeline.md` covering worker checks, queue metrics, DLQ inspection, safe replay, credential failures, stuck claims, and rollback.

The operator endpoint uses the request's authenticated Supabase session. It never creates a service-role client for browser/admin reads; guarded RPCs return safe projections and independently verify platform-admin status.

## 12. Testing Strategy

### Database and migration tests

- Extension/queue creation is idempotent.
- Production/staging/local/CI capability checks prove the same required PGMQ function signatures.
- Trigger enqueue commits with the source mutation and disappears on rollback.
- Only allowlisted column changes emit events.
- Delete tombstones contain no forbidden fields.
- RLS/grants prevent anonymous and authenticated queue access.
- Producer RPC creates one ledger/queue message for concurrent duplicate `(producer, idempotency_key)` submissions.
- Internal UUID and external text event IDs remain distinct end to end.
- Route RPC creates each `(domain_event_id, destination)` once under concurrent replay and refuses a mismatched queue message ID.
- Claim token blocks stale completion.
- Claim RPC uses non-blocking `SKIP LOCKED` semantics with concurrent workers.
- Retry scheduling and max-attempt DLQ transition are deterministic.
- Replay is audited and cannot mutate the payload.
- Ingress failure recording and PGMQ archival are atomic.
- Stale-lease recovery appends the abandoned attempt before re-claiming.
- Authenticated non-admin callers cannot list or replay pipeline failures.
- Retention work is capped and cannot remove unresolved failures.

Implemented evidence includes `supabase/tests/domain_event_pipeline.sql`, which transactionally exercises atomic analytics/platform producers, selective CDC rollback, producer dedupe, route/archive, claims, dead-lettering, destination replay, stale-lease audit, ingress replay, and authorization denial against a current-schema PostgreSQL 17 clone.

### Unit tests

- Every event schema version and rejection case.
- Event-name normalization from current web/mobile formats.
- Trust assignment is server-owned; body-supplied trust/destination fields are rejected or ignored according to the strict schema.
- Anonymous/client purchase events cannot resolve server-side purchase conversion routes.
- Merchant host/body mismatches, oversized payloads, stale timestamps, and unknown fields are rejected.
- Complete route registry coverage.
- Per-destination redaction.
- Retry/permanent/ambiguous error classification and deterministic jitter.
- Backoff calculation with deterministic jitter injection.

### Integration tests

- API insert + queue enqueue atomicity.
- Router crash after delivery insertion but before ingress archive; replay remains duplicate-free.
- Delivery crash after provider success but before completion; destination idempotency prevents duplicate conversion where supported.
- Ambiguous provider outcomes enter `delivery_unknown` when idempotency is not proven.
- One destination fails while others deliver.
- Poison event reaches DLQ and can be replayed after a code fix.
- Worker overlap is prevented by both DB claims and VPS `flock`.
- Long-poll service restart and cron recovery meet the queue-latency SLO.

### Quality gates

- Run focused Vitest suites from `apps/web` where `@/` aliases are required.
- Run `pnpm turbo lint`, `pnpm turbo typecheck`, and `pnpm turbo test`.
- Run `coderabbit review --prompt-only -t uncommitted` and resolve critical/high findings before commit.
- Never run `vercel build`; deployment must use the documented VPS/prebuilt flow.

## 13. Delivery Phases

### Phase 0 — capability and contract gate

- Verify production Postgres version and installed `pgmq` availability read-only.
- Verify staging, local Supabase, and CI support the same PGMQ functions and logged queue behavior; record exact versions.
- Measure current `/api/events` and conversion volume by event type.
- Inventory every current `sendToAdPlatforms()` producer and event-name variant.
- Inventory `triggerPurchaseConversion`, `paid-order-ad-tracking-executor`, and every other server-confirmed conversion producer so no purchase path is omitted or delivered twice.
- Approve the internal/external ID model, enforced idempotency keys, PII policy, route registry, provider-specific ambiguity matrix, retry rules, mutation-latency budget, queue SLO, and retention.
- Exit: signed contract and proven queue support; no production mutation yet.

Implementation status: local substrate research and code are complete. Production 17.6 → 17.10 maintenance planning, current provider-specific proof, and staging drills remain rollout work.

### Phase 1 — durable substrate

- Add shared schema/tests, event ledger, logged queue, ingress failure ledger, delivery tables, RPCs, and database contract tests.
- Add always-on long-poll worker services and one-minute recovery sweeps in dry-run mode, disabled by feature flag.
- Exit: crash/replay/concurrency tests pass locally and in staging.

Implementation status: code and local lifecycle tests complete; staging application remains intentionally pending.

### Phase 2 — analytics shadow routing

- Atomically enqueue from `/api/events` while retaining current direct fan-out.
- Router writes `shadow` route decisions but sends nothing externally.
- Shadow rows use terminal `shadowed` status, are excluded from claims, and are never promoted at cutover.
- Compare event counts, destination decisions, payload redaction, and dedupe IDs for at least 48 hours.
- Ship ingress/DLQ listing, unknown-delivery listing, single-item replay, heartbeat monitoring, and the operator runbook; connect the emitted signals to the production alert transport.
- Perform poison-message, stale-claim, worker-restart, and replay drills in staging.
- Exit: no unexplained count mismatch, no sensitive payload leakage, queue SLO met, and operators can inspect and replay failures safely.

Implementation status: safe operations, heartbeat rows, and structured alert signals are code-ready and disabled. Alert transport, the 48-hour shadow observation, and staging drills remain rollout gates.

### Phase 3 — analytics delivery cutover

- Enable worker delivery for one merchant and one destination first.
- Keep legacy delivery during the canary only after same-ID provider deduplication is proven; the global legacy cutover gate cannot close until all destinations and the explicit `*` merchant scope are active.
- Prove that destination's stable provider ID and ambiguous-outcome behavior before enabling it.
- Expand destination-by-destination, then merchant-by-merchant.
- Exit: delivery SLO and deduplication proven for seven days.

### Phase 4 — platform events consolidation

- Validate and cut over the durable `/api/analytics/conversion` and `/api/platform/events` producers already implemented behind fail-closed flags.
- Remove duplicate forwarding implementations after parity tests.
- Exit: one canonical routing registry and no detached critical external delivery.

Implementation status: producer code is complete and disabled; parity observation and legacy-path removal remain rollout work.

### Phase 5 — selective database CDC

- Enable `products` first, measure trigger/queue overhead, then orders/transactions in observation-only mode.
- Do not attach money-moving consumers.
- Add new consumers only through separately reviewed route-registry changes.
- Exit: mutation latency remains within budget, no queue backlog, and tombstone/replay drills pass.

### Phase 6 — operational hardening

- Operationalize the shipped capped replay and retention controls; add richer dashboards, tune the already-connected production alerts, and run quarterly replay drills. Safe reads, single replay, heartbeats, alert transport, and structured signals must already be live before Phase 3.
- Document ownership and incident response.
- Exit: an operator can identify, explain, and safely replay a failed delivery without database shell access.

Implementation status: capped replay, safe admin projections, heartbeats, retention, and runbook are implemented. Alert transport connection remains a pre-Phase-3 rollout gate; richer dashboards and quarterly production drills remain later operations.

## 14. Rollback Strategy

- Feature flags separately control enqueue, routing, and each destination delivery.
- Disable destination delivery first; queued messages remain durable.
- Re-enable the old direct fan-out temporarily only after confirming event-ID deduplication behavior.
- Stop or disable the long-poll `systemd` services without deleting queue or ledger data; the recovery sweep remains disabled while routing is paused.
- Disable CDC triggers individually if mutation latency or queue volume regresses. Do not drop queues/tables during rollback.
- Preserve queued, archived, and dead-letter records until the incident is resolved.
- Roll forward with corrective append-only migrations; never edit an applied migration.

## 15. Definition of Done

Code implementation is complete when the local gates in this branch pass. Production rollout is complete only when:

- approved database changes are captured transactionally and safely;
- producer retries create one ledger row and one ingress message per enforced idempotency key;
- internal UUIDs and external provider IDs remain distinct and stable;
- every supported event resolves through one versioned route registry;
- each destination has independent delivery state and idempotency;
- transient failures retry with bounded backoff;
- permanent/exhausted failures enter a visible, auditable DLQ;
- replay is safe, permissioned, immutable, and tested;
- ingress failures, destination dead letters, and ambiguous deliveries are separately visible and operable before cutover;
- queue age, delivery latency, retries, and DLQ growth are monitored;
- the always-on workers meet the approved enqueue-to-first-attempt SLO and recover through the VPS sweep;
- current analytics/conversion paths no longer depend on detached delivery;
- staging crash/replay drills and production canary gates pass.

No PR, merge, or passing local test may be described as production completion before those rollout gates pass.

## 16. Primary Research Sources

- [Supabase Queues](https://supabase.com/docs/guides/queues)
- [Supabase PGMQ API and visibility semantics](https://supabase.com/docs/guides/queues/pgmq)
- [Supabase Queues quickstart and logged versus unlogged queues](https://supabase.com/docs/guides/queues/quickstart)
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Supabase `pg_net` limitations](https://supabase.com/docs/guides/database/extensions/pg_net)
- [PostgreSQL trigger behavior](https://www.postgresql.org/docs/current/trigger-definition.html)
- [PostgreSQL logical decoding concepts and duplicate responsibilities](https://www.postgresql.org/docs/17/logicaldecoding-explanation.html)
- [Supabase project upgrade process and current PG17 notes](https://supabase.com/docs/guides/platform/upgrading)
- [PostgreSQL supported-version policy](https://www.postgresql.org/support/versioning/)
- [Next.js `after()` lifecycle and duration](https://nextjs.org/docs/app/api-reference/functions/after)
