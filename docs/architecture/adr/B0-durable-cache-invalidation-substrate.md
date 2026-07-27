# ADR B0 — Canonical durable storefront cache transitions

**Status:** adopted design; implementation gated · **Date:** 2026-07-27

## Decision

B0 extends PR #3077's canonical pipeline. Each cache transition is one normal canonical PGMQ event named `storefront.cache_transition.v1`, with one canonical `event_deliveries.destination` value, `storefront_cache_transition`. It reuses `domain_event_ledger`, PGMQ identity, `event_deliveries`, attempt audit, retry/backoff, dead letter, replay, heartbeats, continuous VPS services, and service-role claim-token rules.

It does not create `cache_invalidation_outbox`, a second PGMQ queue, queue-less ledger/direct-ingress records, two cache delivery destinations, a cron drainer route, a new schedule/service/listener, or a parallel retry/DLQ/replay system.

`storefront_cache_transition_obligations` is permitted only as specialized, transactionally visible cache semantics. It is keyed to the canonical `domain_event_id`, stores server-derived target data and generation/successor state, and is never itself a queue. The service-only `storefront_cache_transition_canaries` table is the executable merchant gate. Private SQL-internal `ensure_storefront_cache_transition_from_category_row_v1` accepts `TG_OP` plus explicit safe OLD/NEW snapshots (`id`, `merchant_id`, `slug`, `name`, `is_active`, `parent_id`) from the trigger; it has no client grants or merchant input, so DELETE remains valid after its source row disappears. It creates/reuses the obligation and normal canonical PGMQ event atomically. The event envelope carries only `obligation_id`; the authoritative DB obligation is the current identity/slugs payload source.

## Routing and exclusion contract

The capable existing PGMQ router reads normal messages and dispatches the exact database-trusted name `storefront.cache_transition.v1` to one specialized routing operation. That operation validates the linked obligation, inserts/reuses one `storefront_cache_transition` delivery, marks the obligation routed, and archives the exact PGMQ message atomically. It is the only normal-router branch for this event name.

PGMQ `read_with_poll` has no predicate, so B0 does not claim pre-read SQL isolation. The bounded shared-ingress risk is explicit: a stale router that sees the event must database-refuse/defer it and never dead-letter it; producer activation requires a fresh capable router and delivery-worker heartbeat; queue-age alerts and load/poison-message latency tests are launch gates. Generic ingress dead-letter RPCs refuse linked cache messages, while generic analytics delivery claims exclude `storefront_cache_transition`. The separate destination-filtered cache delivery lane uses the same continuous worker and canonical delivery lifecycle.

The existing continuous `process-domain-events.ts` service gains the exact capable-router branch/flag. The existing continuous `process-event-deliveries.ts` service gains an independent cache-delivery loop/flag that claims only `storefront_cache_transition`. The existing service installation and one-minute recovery sweeps remain unchanged; B0 adds no cron route, crontab entry, service, or schedule.

## Atomic producer and generation contract

The category `AFTER INSERT OR UPDATE OR DELETE` trigger is server-side gated by `domain_event_producer_config` plus canary merchant configuration held in the database. It serializes only safe category identity, old/new slugs, and server-derived cache keys. It invokes `ensure_storefront_cache_transition_from_category_row_v1` in the source mutation transaction. If event/obligation creation fails for an enabled canary, the category mutation rolls back; if disabled/not-canary, no event exists.

The obligation carries `generation`, authoritative target payload, and `successor_of`; it has no per-stage checkpoints. A newer pre-claim change increments the one pending obligation generation. Once claimed, it creates or updates at most one pending successor event/obligation and never mutates the claimed generation. The database permits a claimed predecessor plus one pending successor, but permits only one pending tail per `(merchant_id, category_id)` and one pending row per `successor_of`; further mutations coalesce into that tail. Cache claim refuses a successor until its predecessor delivery is terminal. The worker materializes current obligation state, not its stale event envelope. `finish_storefront_cache_transition_delivery_v1` first fences `(delivery_id, claim_token, obligation_id, generation)` and then applies canonical terminal/retry semantics in one transaction, preventing an old worker from completing newer work. Rename data preserves both old and new semantic targets in the same generation; no client supplies a URL, hostname, tag, or path.

## Delivery contract

For each claimed cache delivery, the existing event-delivery worker calls one narrow authenticated Vercel-origin actuator and consumes its typed full-barrier receipt. The actuator implements a dedicated category barrier using existing low-level primitives in order: positional `revalidateCategories(merchantId, slug, { expireImmediately: true })` for old/new/related slugs; `productCacheRevalidation.revalidateProducts(merchantId, undefined, { expireImmediately: true, feedScope: 'merchant' })` and requires `true`; foreground `purgeVercelStorefrontPublicationCache(buildStorefrontPublicationCacheTags(identity))`; then foreground `purgeCloudflareHostnamesConfirmed(buildStorefrontPublicationPurgeHostnames(identity.identifiers))`. Every stage fails closed. `evictStorefrontPublicationCaches` is evidence for ordering and credential closure, not the callable because its Next invalidation is publication-only. Canonical delivery finishes only after the whole category barrier succeeds. The worker has no Cloudflare token and no invented per-stage checkpoint RPCs.

The actuator has dedicated worker authentication and executes only its bounded full category barrier. It has no Supabase/service-role client, raw Cloudflare token, claim, retry, finish, replay, or database authority. A caller cannot choose arbitrary cache operations; the worker sends the obligation ID, generation, exact configured canary merchant ID, and bounded old/new/related category slugs under the request-bound HMAC contract. It sends no host, URL, identity array, or operation selector.

URL-only purge is correctness-incomplete because shared category navigation is embedded in cached home, category, PDP, blog, static, trust, and compare HTML. The B0 production canary reuses the existing confirmed hostname-purge surface, whose builder maps only the approved canary merchant/domain to `ogabassey.com` and `www.ogabassey.com` and rejects unknown stores. The actuator fails closed unless running on Vercel; it must not inherit the publication route's tolerated `not_running_on_vercel` result. Missing configuration, unknown store, non-Vercel runtime, timeout, transport error, non-2xx, malformed response, `success:false`, partial failure, and `429` produce a retryable full-barrier failure. Since Next, Vercel, and hostname purge are idempotent, a retry reruns the entire barrier. Cache-Tag purge, origin `Cache-Tag` emission, protected `proxy.ts`, arbitrary aliases/hosts, and all TTL/cache-directive changes are out of scope.

## Flags and authority

All controls default disabled and are independent:

- The service-only `storefront_cache_transition_canaries` row plus the producer configuration gate the trigger's server-side enqueue.
- `STOREFRONT_CACHE_TRANSITION_ROUTING_ENABLED` gates the specialized lane in `process-domain-events.ts`.
- `STOREFRONT_CACHE_TRANSITION_DELIVERY_ENABLED` gates the specialized lane in `process-event-deliveries.ts`.
- `STOREFRONT_CACHE_ACTUATOR_SECRET` authenticates only worker-to-actuator requests.

The event-pipeline authority manifest must explicitly allow exact new cache RPCs from the existing worker scripts. The actuator has dedicated request authentication; its closure excludes Supabase service/admin clients, raw Cloudflare token/environment access, and database claim/retry/finish modules, while permitting only the exact existing Cloudflare helper/builder closure. No new Cloudflare authority is granted to the worker. The narrow authority approval is already satisfied; every `EVENT_PIPELINE_BOUNDARY.authority.*` array remains byte-identical.

## Scope, rollout, and rollback

B0 delivers the reusable substrate and one category canary only. It excludes critical-shell generations, renderer work, product/PDP/blog/inventory/import coverage, broad merchant canaries, TTL changes, and Cloudflare Cache-Tag work.

Deploy the migration and existing worker code with all flags disabled; prove generic-lane exclusions and empty specialized loops; enable specialized routing/delivery; enable one staging category canary; drill crash between every stage, stale claim, retry, dead letter, and replay; enable one production merchant/category for 48 hours while comparing analytics behaviour; then hand the substrate to B1-durable. Roll back by disabling enqueue, routing, then delivery; retain canonical events, obligations, deliveries, attempts, and dead letters. Repair only forward with append-only migrations.
