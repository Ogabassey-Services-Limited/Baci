# Baci PostgreSQL 17 to 18 Upgrade and Performance Plan

**Status:** Current evidence-backed PostgreSQL 17 PR stack prepared; PostgreSQL 18 production upgrade is blocked
**Decision date:** 2026-07-12
**Live project:** `aivqthbxdshhltbwipbr` (`eu-west-1`)
**Source baseline:** `origin/main` at `11f2a68f0c3eff7ae4836a16e3b69667c23149d9`
**Live evidence window:** 2026-07-12 19:03-20:02 UTC (20:03-21:02 WAT), as noted below
**Scope:** Hosted Supabase PostgreSQL, bundled platform services, Baci web/mobile/API
database paths, and the performance work unlocked or made easier by PostgreSQL 18
**Mode:** Plan plus execution status. This document authorizes no production mutation or upgrade.

`origin/main` above is the planning baseline, not a future cutover identifier. The
execution baseline must be the immutable application deployment commit/release plus
the exact live migration ledger and schema hashes captured at freeze time. Begin
implementation in a fresh worktree from then-current `origin/main`; the checkout in
which this plan was authored is intentionally not treated as current production.

## Implementation status — 2026-07-13

The low-risk PostgreSQL 17 work that can be justified from current repository and
live-workload evidence is merged or prepared as independent pull requests. “Ready”
below means committed, pushed, and validated before review; it does not mean the
change has been merged, deployed, applied to production, or measured in a clean
post-deployment window.

| Plan area | Delivery | Status |
| --- | --- | --- |
| Authenticated mobile-catalog RLS cliff and oversized variant-batch observability | [#3081](https://github.com/ogabasseyy/Baci/pull/3081) | Merged. Catalog variants use the bounded RPC, and batches above 10,000 IDs raise SQLSTATE `22023`. |
| Reset-safe PostgreSQL baseline and delta harness | [#3089](https://github.com/ogabasseyy/Baci/pull/3089) | Ready. Must merge and capture a clean post-#3081, pre-#3090–#3097 deployment baseline before the remaining performance migrations are applied. |
| Search-suggestion GIN candidate gate | [#3090](https://github.com/ogabasseyy/Baci/pull/3090) | Ready. |
| Mobile order-count fanout consolidation | [#3091](https://github.com/ogabasseyy/Baci/pull/3091) | Ready. |
| Customer-policy Auth InitPlan optimization | [#3092](https://github.com/ogabasseyy/Baci/pull/3092) | Ready. |
| Mobile dashboard aggregate consolidation | [#3093](https://github.com/ogabasseyy/Baci/pull/3093) | Ready. |
| First proven duplicate-index removal | [#3094](https://github.com/ogabasseyy/Baci/pull/3094) | Ready. Remaining index and foreign-key candidates require reset-bounded usage and plan evidence. |
| Website analytics aggregate spill reduction | [#3095](https://github.com/ogabasseyy/Baci/pull/3095) | Ready. |
| High-call feature-settings policy role scoping | [#3096](https://github.com/ogabasseyy/Baci/pull/3096) | Ready. |
| Analytics visibility-map/autovacuum tuning | [#3097](https://github.com/ogabasseyy/Baci/pull/3097) | Ready. Requires one authorized low-traffic `VACUUM (ANALYZE, TRUNCATE FALSE)` after the migration is applied. |

No additional production change is currently justified for the blog counter,
remaining broad product callers, extended statistics, Realtime-versus-polling
attribution, Auth connection allocation, or the remaining index/foreign-key
candidates. Those items require the restored-clone experiments or post-`#3089`
reset-safe deltas specified below; implementing a design before that evidence would
violate the plan's attribution and safety gates.

The PostgreSQL 18 engine comparison, exact-bundle compatibility work, rehearsal,
cutover, and PostgreSQL 18-only pilots remain externally blocked until Supabase
offers this project a GA PostgreSQL 18 target and a matching rehearsal environment.
Therefore, completing the prepared pull requests completes the currently actionable
code phase, not the hosted PostgreSQL 18 upgrade or its post-deployment proof.

## 1. Executive decision

Do not attempt the PostgreSQL 18 production upgrade yet.

The authenticated Supabase upgrade-eligibility response currently offers Baci only
a newer PostgreSQL 17 platform build (`supabase-postgres-17.6.1.141`). It does not
offer a PostgreSQL 18 target. Supabase's hosted upgrade documentation also has no
PostgreSQL 18-specific hosted notes or target-extension matrix yet.

The execution gate is therefore:

1. Prepare and optimize the current PostgreSQL 17 workload now.
2. Re-run the authenticated eligibility check periodically.
3. Rehearse only when Supabase offers a PostgreSQL 18 **GA** target on the exact
   hosted bundle Baci will receive.
4. Upgrade to the latest GA PostgreSQL 18 minor offered by Supabase, not 18.0.
   The current upstream minor is 18.4, but the eventual hosted target may be newer.
5. Use Supabase's Dashboard upgrade flow. Do not substitute a self-hosted
   `pg_upgrade`, logical-replication migration, or a provider move for this plan.

The current Dashboard/eligibility estimate of one hour belongs to the offered
PostgreSQL 17 platform update. It is not an estimate for PostgreSQL 18.
Treat that PG17 platform update as a separate change with its own release notes,
rehearsal, and go/no-go decision; it is neither a required source step nor evidence
that the later PG18 bundle will be eligible.

## 2. Why the upgrade alone is not the performance program

PostgreSQL 18 improves I/O, planning, joins, aggregation, vacuum, index builds, and
observability. Baci will receive some improvements automatically, but the largest
known Baci costs are currently dominated by request/query amplification and query
shape:

- route and client surfaces repeatedly read products, categories, variants, and
  merchant settings;
- search, suggestions, semantic guide selection, dashboards, and wide PostgREST
  joins consume significant cumulative execution time;
- the current 17-day database-statistics window contains about 109 GB of temporary
  data across 26,610 temporary files;
- `products` has 37 indexes for only about 2,829 live rows, while `orders` has 17;
- the database fits mostly in memory/cache, so PostgreSQL 18 AIO is unlikely to be
  Baci's largest warm-path gain today;
- recent storefront snapshot work landed during the cumulative statistics window,
  so current cumulative means mix old and new implementations and cannot be used
  as a clean post-change baseline.

The program must measure four layers separately:

1. engine-only PostgreSQL 17 versus 18 behavior;
2. PostgreSQL 18 configuration/provider behavior;
3. Baci query/schema/index changes;
4. application fanout, caching, and transport behavior.

## 3. Confirmed current-state baseline

### 3.1 Platform and capacity

| Item | Confirmed state |
| --- | --- |
| Project health | `ACTIVE_HEALTHY` |
| PostgreSQL | 17.6, Supabase build `17.6.1.032`, ARM64 |
| Hosted PG18 availability | Not offered for this project |
| Offered update | PG17 build `17.6.1.141`, eligible, separate one-hour estimate |
| Compute | Micro: 2 shared ARM cores, 1 GB RAM |
| Direct/pooler limits | 60 direct connections, 200 pooler clients |
| Disk | 8 GB GP3, 3,000 IOPS, 125 MiB/s |
| Database size | 363,916,435 bytes, approximately 347 MiB |
| Shared buffers | 256 MB |
| Work memory | 3,500 kB per sort/hash operation |
| Parallelism | 2 max parallel workers, 1 per gather |
| Connections observed | Same-day samples showed 24-27 total, 21-23 idle, 2 active, 0 idle-in-transaction |
| Poolers | Shared Supavisor transaction mode on 6543; dedicated PgBouncer transaction mode; SCRAM |
| `track_io_timing` | Off |
| JIT | Off |
| Data checksums | Off |
| Locale provider | ICU (`en-US`), UTF-8 |
| Read replicas | None; only the primary source is configured |
| PITR | Disabled |
| Latest checked physical backup | Completed 2026-07-12 05:09:37 UTC |

PITR is not an upgrade prerequisite. Enabling it currently requires at least Small
compute and would be a separate cost/capacity/RPO decision, not a PostgreSQL 18
checkbox.

### 3.2 Database objects and upgrade-sensitive services

- 148 public tables, 23 auth tables, 10 Realtime tables, 8 Storage tables, and 3
  private tables were visible in the live compact inventory.
- User schemas have 636 indexes: 96 partial indexes, only one `INCLUDE` index, and
  no extended-statistics objects. This is an inventory fact, not a recommendation
  to add covering indexes or extended statistics broadly.
- Installed extensions are `hypopg`, `index_advisor`, `pg_cron`, `pg_net`,
  `pg_stat_statements`, `pg_trgm`, `pgcrypto`, `plpgsql`, `supabase_vault`,
  `unaccent`, `uuid-ossp`, and `vector`.
- `pg_graphql` and `ltree` are not installed.
- Two temporary Supabase Realtime logical slots appeared during the first read-only
  sample. A later same-day sample showed zero slots and zero walsenders, confirming
  that these rows are transient managed activity, not a physical standby. Do not
  manually delete managed Realtime slots.
- There is no user-created logical slot or subscription.
- There was no physical standby/read-replica signal. Re-query slots, subscriptions,
  and walsenders at T-24h and T-0; any target-time row not accepted by PG18
  eligibility or written Supabase guidance blocks cutover.
- User schemas have no unsupported `reg*` columns. Managed Realtime has `regclass`
  and `regrole` columns; these specific types are supported by PostgreSQL 18's
  `pg_upgrade`, and the current Supabase eligibility check is clean.
- There are no invalid indexes and no prepared transactions.
- `cron.job_run_details` is about 3.1 MB with roughly 414-415 rows. It is not a
  material upgrade-size risk, though retention must remain enabled.
- The current PG17 eligibility response reports no unsupported extensions, objects
  to drop, internal-schema user objects, validation errors, or warnings. This does
  not substitute for a future PostgreSQL 18 eligibility response.
- The live migration ledger contains 338 versions while the refreshed
  `origin/main` inventory has 322 distinct numeric prefixes plus 16 live-only
  timestamp variants. Several appear to be semantically renamed copies. Filename
  counts are not a safe parity gate: compare migration names plus function, view,
  policy, trigger, table, and index-definition hashes against the live clone.

### 3.3 Workload evidence

The statistics were reset with the PostgreSQL restart at 2026-06-25 12:01:56 UTC,
so the observations below span about 17 days and include deployments made during
that interval. Treat them as candidate discovery, not current SLO measurements.

| Business operation or shape | Cumulative signal | Interpretation |
| --- | ---: | --- |
| Mobile catalog product + nested variant/category read | Authenticated: about 5,623 calls, 1.266 s mean, 7.377 s max; anonymous: about 8,059 calls, 10.86 ms mean, 91 ms max | Highest-priority authenticated RLS/query-shape cliff; cumulative window still spans deployments |
| Product + product-category nested read | About 1.13 million calls, 6.1 ms mean | Small per call, very large amplification |
| `get_storefront_cluster_guide_candidates_v1` | About 33k calls, 164 ms mean | Hash/join/JSON/CTE candidate; recent bounded implementation needs a clean delta window |
| `get_storefront_pdp_core_v2` | About 113k calls, 43 ms mean | Important storefront contract; engine non-regression gate |
| `get_storefront_pdp_semantic_enrichment_v1` | About 5.4k calls, 201 ms mean | Join/aggregate/cache opportunity |
| `find_product_search_suggestion_v2` | Historical entry about 3.2k calls, 366 ms mean | Query still recomputes normalizers and similarity across merchant products |
| `search_products_v2` | Historical entries about 43-48 ms mean | Uses trigram/FTS, optional OR filters, window count, sort, and OFFSET |
| Mobile dashboard aggregate | About 727 calls, 479 ms mean | Hash aggregate/join and query-shape candidate |
| Filtered order list/count | One entry about 4.4k calls, 161 ms mean | Optional predicates, exact count, pagination, and composite-index candidate |
| `product_feed_images` reads | About 71k calls, 23 ms mean | Feed/image projection and join non-regression candidate |
| Realtime list-changes statement | About 901k calls, 6.2M ms total, and 1.65B shared hits | Provider-managed high-frequency workload with possible Baci subscriber/poll amplification; isolate both before assigning ownership |
| `increment_blog_post_views` | About 11k anonymous calls, 126.5 MB WAL, 22k full-page images | Wide-row counter write amplification; 18k table updates were only about 50% HOT despite 901 live blog rows |
| `analytics_events` inserts | 63,677 inserts and about 449 MB WAL in the sampled top statement | UUID/index/write-amplification candidate |

Current database-wide counters show 109,092,645,961 temporary bytes and 26,610
temporary files over the same 17-day uptime, approximately 6.3 GB/day if spread
evenly. That rate must be measured as daily deltas before and after each change.

## 4. Success criteria

### 4.1 Upgrade correctness gates

- All PostgreSQL, extension, RLS, grant, trigger, function, view, cron, Auth,
  Realtime, Storage, PostgREST, pooler, and application smoke tests pass.
- Payment initialization, payment webhooks, idempotent replay, checkout, order
  creation, order tracking, inventory mutation, merchant/admin overlap, staff
  access, and customer Auth have zero correctness drift.
- Storefront search/autocomplete results and ranking pass the existing locale,
  exact-SKU, typo, condition, and stock-filter regression suites.
- Full-text and trigram indexes are rebuilt or explicitly proven semantically safe
  after the ICU-related PostgreSQL 18 text-search change.
- No invalid index, missing extension, stale generated expression, broken
  publication, stuck cron, or unbounded replication slot remains.

### 4.2 Performance acceptance gates

Use matched 30-minute or longer windows at comparable traffic, plus a controlled
clone replay. Do not approve from a single `EXPLAIN ANALYZE`.

- Tier-0 payment/order/Auth operations: p95 and p99 no more than 5% slower; error
  and timeout rates no worse than baseline.
- Public storefront database operations: no operation more than 10% slower at p95;
  the mixed workload must have equal or better throughput at equal concurrency.
- Any feature claimed as a PostgreSQL 18 win must improve its intended metric by at
  least 10% in repeated trials, or be labeled “no measured Baci benefit yet.”
- Search suggestion/query refactors should target at least 50% lower p95 on the
  production-sized clone without changing ranked result sets.
- Temporary-byte rate should not increase. The combined query program targets a
  reduction from the current approximate 6.3 GB/day to below 3.2 GB/day, but this
  is a program target, not an automatic PostgreSQL 18 promise.
- Database connections stay below 80% of the 60-connection ceiling during normal
  peaks, with zero pool-acquisition timeouts and zero idle-in-transaction sessions.
- Storefront p75 LCP stays below 2.5 seconds and CLS below 0.1; server/database
  changes must not damage the existing cache/snapshot work.

## 5. PostgreSQL 18 performance-benefit map for Baci

### 5.1 Automatic or planner-selected benefits

| PostgreSQL 18 capability | Baci application | Activation | Priority and proof |
| --- | --- | --- | --- |
| Asynchronous I/O for sequential scans, bitmap heap scans, and vacuum | Cold product/blog/analytics scans, bitmap trigram/FTS reads, retention cleanup, vacuum | Provider must expose a non-`sync` `io_method`; also capture `io_workers`, `io_max_concurrency`, `io_combine_limit`, `io_max_combine_limit`, `effective_io_concurrency`, and `maintenance_io_concurrency`. A non-`sync` method alone does not prove requests are asynchronous. | Medium. Current window shows about 5.86B buffer hits but only about 226 MiB of client relation reads, plus about 460 MiB autovacuum reads. Sample `pg_aios` during load—it may be empty between operations—and correlate it with `pg_stat_io`, wait events, and provider storage metrics. Separate buffer-cold from genuinely storage-cold tests. Never claim upstream “up to 3×” as overall Baci uplift. |
| B-tree skip scan | Existing multicolumn product, order, analytics, and status/time indexes; optional-filter queries that omit an early column | Planner selected; no reindex required | Medium/high as an index-consolidation enabler. Confirm `Index Searches` in PG18 `EXPLAIN`; preserve tenant-leading indexes until proven redundant. |
| OR-to-array index conditions and better `IN (VALUES ...)` handling | `search_products_v2`, stock/status filters, order filters, bulk product/variant ID reads | Automatic when query shape qualifies | Medium. Compare plans and row estimates; current complex negative/NULL ORs may not qualify. |
| Faster/lower-memory hash joins and hash `GROUP BY` | Mobile dashboard, merchant summaries, semantic enrichment, product/category/spec/variant joins | Automatic | High. Measure spills, peak memory, p95, and result parity. |
| Merge joins using incremental sort; right semi joins; self-join elimination | `EXISTS`/membership checks, generated PostgREST joins, category/product joins | Automatic when planner chooses it | Medium. Record plan changes; self-join elimination applies only to qualifying plain-table self joins. |
| Faster DISTINCT, window aggregates, `INTERSECT`/`EXCEPT`, view-alias processing, redundant GROUP BY removal, and qualifying HAVING pushdown | Search `count(*) OVER()`, guide ranking, PostgREST views, analytics/dashboard aggregation, deduplication | Automatic when the exact shape qualifies | High for search/dashboard. Compare whether eliminating the exact count or repeated scan is still a larger win. |
| Better `generate_series(numeric/timestamp)` estimates | `get_monthly_sales_stats`, reporting series, retention/backfill queries | Automatic | Low today: the current monthly-sales function generates only six rows, and the seven-scan dashboard RPC does not use `generate_series`. Compare estimated versus actual rows and downstream join/aggregate choice without attributing unrelated dashboard gains to this feature. |
| Better SQL-language function plan caching | High-call SQL RPCs and RLS/access helpers | Automatic | Medium. Inventory SQL-language functions by call volume; PL/pgSQL functions do not receive this exact benefit. |
| Faster planning for many partitions and improved partitionwise joins | Supabase-managed Realtime partitions now; potential future analytics partitioning | Automatic planning improvements; partitionwise join/aggregate remain opt-in | Low today. Baci's 101k-row analytics table is far below a partitioning threshold. |
| Better relation-locking performance with many relations | Large PostgREST joins, migration checks, partition maintenance | Automatic | Low/medium; observe planning/lock wait deltas. |
| Eager freezing during normal vacuum | `analytics_events`, push tickets, imports, orders, blog updates | Automatic default, controlled by `vacuum_max_eager_freeze_failure_rate` if exposed | Medium. Track vacuum time, frozen pages, foreground latency, and wraparound age. |
| Faster JSON-string and numeric CPU paths; ARM popcount paths | JSONB event/specification processing, semantic rules, order/payment numeric work, ARM Micro compute | Automatic only when build/CPU path qualifies | Low/medium. Include JSON/numeric cases in replay; do not design around unconfirmed CPU features. |
| Optimizer-statistics retention through `pg_upgrade` | Avoids a post-upgrade bad-plan cliff across Baci | Supabase must use the PG18 statistics-preserving path | High operational value. Extended/custom and cumulative monitoring statistics are not fully preserved. Require the staged missing-statistics, reindex, and full-`ANALYZE` sequence below rather than treating retention as complete. |
| Reduced `pg_stat_statements` bloat for differing `SET` constants | PostgREST/session setup and local settings such as trigram thresholds | PG18 extension binary/version | Low/medium observability benefit; compare statement cardinality and evictions. |

### 5.2 Opt-in, rebuild, or code/schema benefits

| Capability | Baci candidate | Decision |
| --- | --- | --- |
| Parallel GIN builds | Required FTS/trigram reindex and future product/blog search-index builds | Use on the rehearsal target if Supabase exposes enough maintenance workers/memory. It shortens builds; it does not make existing GIN lookups faster. |
| `uuidv7()` | Pilot future rows on `analytics_events`, then consider push tickets, import rows, search analytics, order-tax rows, and new event/audit tables | High-write pilot after the engine upgrade. Never rewrite existing primary keys solely for locality. Preserve UUID API shape; document timestamp leakage and never treat IDs as secrets. |
| `RETURNING OLD/NEW` | Inventory reservations, stock/status transitions, order/payment mutations, audit-event creation | Audit mutation-plus-follow-up-read paths. Replace only where one statement can preserve authorization, idempotency, and audit semantics. |
| Virtual generated columns | Non-indexed arithmetic columns: `inventory_snapshots.available_quantity`, `customer_rfm_scores.rfm_score`, `chat_orders.total` | Low priority and benchmark-only. Existing stored search columns must remain stored/indexable. Virtual generated values cannot be logically replicated: inspect publication membership, column lists, and Realtime consumers per candidate and retain `STORED` whenever downstream payloads need the value. Make `STORED` or `VIRTUAL` explicit in every new migration because PG18 changes the default. |
| Improved GIN/GiST/B-tree build paths | Product/blog FTS, trigram and future range indexes | Maintenance-window benefit only; validate with `amcheck` where available. |
| `PG_UNICODE_FAST` and `casefold()` | Search normalization experiments | Shadow-test only. Do not replace natural-language storefront ordering; a collation change changes semantics and requires rebuilds. |
| Parallel partitionwise join/aggregate | Future aligned analytics partitions | Leave off globally. It can multiply `work_mem` consumers per partition. Test per session only after an actual partitioning need exists. |
| New vacuum controls | High-churn analytics/push/import tables | Test `vacuum_max_eager_freeze_failure_rate`, `autovacuum_vacuum_max_threshold`, per-relation `vacuum_truncate`, worker-slot behavior, and cost-delay timing only from measured vacuum/freeze/lock evidence. Do not globally raise concurrency on a 1 GB Micro instance. |
| Parallel logical-apply and replication conflict telemetry | No user subscription today; Supabase Realtime is managed | Provider-owned. Use only if a future Baci-owned logical subscription is introduced. |
| `COPY ... ON_ERROR ... REJECT_LIMIT ... LOG_VERBOSITY silent` | Future server-side inventory/import staging with many invalid rows | Benchmark accepted/rejected throughput and log volume. Use `silent` only when independent rejected-row counts and audit artifacts remain available; it must not conceal data-quality failures. This is not a reason to bypass API validation, RLS, or merchant scoping. |

### 5.3 Provider/build-only benefits

The following are not Baci action items unless Supabase explicitly exposes them:

- `io_uring` support and AIO worker counts;
- NUMA-aware builds and telemetry;
- filesystem clone/copy methods;
- backup-combine link behavior;
- parallel `pg_upgrade` checks and the provider's choice of copy/clone/link/swap
  method, which may reduce downtime but cannot be selected from Baci;
- `idle_replication_slot_timeout`: record the hosted value and leave managed
  Realtime slots under Supabase control. If Baci later owns a persistent slot,
  benchmark disconnect/reconnect behavior and WAL retention before enabling it;
  checkpoint-time invalidation can break an intentionally idle consumer;
- global WAL/checkpoint, autovacuum worker-slot, and host-kernel tuning;
- physical/logical replication worker configuration owned by Supabase.

Record these as provider facts during rehearsal. Do not block the upgrade merely
because an optional host-only feature is unavailable.

## 6. Baci performance work that should not wait for PostgreSQL 18

Each item must ship separately from the major upgrade so its effect is attributable.

### P0. Establish clean delta-based observability

1. Snapshot `pg_stat_statements`, `pg_stat_database`, `pg_stat_user_tables`,
   `pg_stat_user_indexes`, `pg_stat_io`, table/index sizes, connections, locks,
   cron, and advisor output at T-7d, T-24h, T-0, T+1h, T+24h, and T+7d.
2. Store exported artifacts outside the production database. Do not reset
   production statistics merely to simplify comparison.
3. Identify statements by normalized operation/query shape plus function/table
   names. PostgreSQL 17 and 18 query IDs are not stable comparison keys.
4. Capture the current PostgREST, Auth, Realtime, Storage, pooler, extension, and
   Supabase Postgres build versions alongside every baseline.
5. Compute daily deltas for calls, total/mean execution time, rows, buffers,
   temporary blocks, WAL bytes, and errors. Cumulative means that span a deployment
   are not release verdicts.
6. Capture `pg_stat_database.stats_reset`,
   `pg_stat_statements_info.stats_reset`, and `pg_postmaster_start_time()` with every
   snapshot. Reject any delta whose interval crosses a statistics reset or restart.
7. PostgreSQL 18 `idx_scan` counts index-search starts, so skip-scan repositioning
   and qualifying OR/array searches can increase it without more executor nodes or
   business calls. Compare `idx_scan` only alongside normalized statement calls,
   PG18 `Index Searches`, tuples read/fetched, and the actual plan.

### P0. Remove the authenticated mobile-catalog RLS cliff

This is the first performance fix because it is already measurable on PostgreSQL
17 and would otherwise contaminate every PostgreSQL 17-versus-18 comparison.

The mobile storefront catalog query in
`apps/mobile-storefront/hooks/product-pages.ts` selects the nested variant shape
from `apps/mobile-storefront/hooks/product-select.ts`. Anonymous catalog rows are
subsequently hydrated through the bounded `get_storefront_product_variants` RPC,
but authenticated reads can directly traverse the `product_variants` SELECT policy.
That policy currently includes an owner subquery plus four
`check_staff_permission()` OR branches per row. The live role-specific statement
evidence is about 1,266 ms authenticated versus 10.86 ms anonymous, while the
existing safe variant RPC averages about 1.81 ms in the cumulative window.

Plan:

1. Remove embedded variants from catalog/listing `PRODUCT_SELECT` reads.
2. Batch-hydrate all variant-bearing catalog results through the existing bounded,
   public-safe variant RPC used by the anonymous path.
3. Preserve selected condition, price, image, stock, serialized-inventory policy,
   merchant scoping, and product ordering for signed-out customers, signed-in
   customers, merchant owners, staff, and the admin-plus-merchant overlap account.
4. Do not weaken RLS to obtain the speedup; eliminate the per-row protected relation
   traversal from a public catalog operation.
5. Measure query count as well as latency so the batch path does not become N+1.

Required proof:

- role-matrix regression tests and result parity for anonymous, customer, owner,
  staff-permission, staff-denied, and platform-admin/merchant overlap identities;
- identical product/variant/stock behavior on web and mobile storefronts;
- bounded batch size and no extra round trip per product;
- authenticated p95 within 20% of anonymous p95 on the restored clone and at least
  80% lower than the current authenticated baseline;
- zero new `check_staff_permission()` calls in the catalog query plan.

### P0. Fix search-suggestion full scans

`find_product_search_suggestion_v2` still calls normalization and `similarity()` on
product names without an indexable trigram prefilter. Rework it, in an append-only
migration, to use the existing stored `search_name_norm` and
`search_name_compact` columns and `%`/GIN candidate gates before exact similarity
ranking. Preserve merchant/status scoping and exact result semantics.

Required proof:

- locale/normalization, exact, typo, empty, no-match, and cross-merchant tests;
- representative `EXPLAIN (ANALYZE, BUFFERS)` on the largest merchant;
- identical suggested term for the regression corpus;
- at least 50% lower p95 on the production-sized clone.

### P0. Attribute and finish product-read de-amplification

The recent `get_storefront_pdp_core_v2` and bounded public snapshot work landed
during the current statistics window. Verify that new daily deltas fall while the
old broad product/variant/category query fingerprints decay.

- Map each remaining broad PostgREST fingerprint to web, mobile-admin,
  mobile-storefront, feed, sitemap, or crawler callers before changing SQL.
- Prefer one bounded RPC/projection for a business operation over nested per-route
  composition.
- Preserve the `found` / `not_found` / `unavailable` and bounded-variant rules in
  `apps/web/src/lib/storefront-pdp-core-snapshot.ts`.
- Avoid adding retries; the current client already has retry behavior and the
  storefront snapshot explicitly disables retry for its total deadline.

### P0. Reduce temp spill at the query, not global-memory, layer

Prioritize search, guide candidates, dashboards, wide product joins, exact counts,
and any statement that produces daily temp-block deltas.

1. Capture JSON plans and identify external sorts, materialized CTE spill, hash
   batches, and wide rows.
2. Reduce selected columns and early candidate sets first.
3. Reconsider `count(*) OVER()` and deep `OFFSET` where callers can accept an
   estimated/first-page count or a stable keyset cursor.
4. Use targeted per-function/session `work_mem` only if spill remains after query
   repair. A global increase can multiply across operations and 60 connections on
   a 1 GB instance.

### P0. Consolidate dashboard scans before relying on skip scan

`get_mobile_admin_dashboard_stats` currently performs seven separate scans, and
its revenue chart repeats a lateral order aggregate for each bucket. The live mean
is about 479 ms in the cumulative window. PostgreSQL 18 skip scan may help queries
that use the existing `(merchant_id, branch_id, created_at DESC)` index while
omitting `branch_id`, but it cannot remove redundant scans.

1. Benchmark branch set and branch absent separately on PostgreSQL 17 and 18.
2. Consolidate compatible aggregates into the minimum bounded scans while
   preserving currency, branch, date-boundary, refund/cancellation, and permission
   semantics.
3. Compare skip scan against a purpose-built measured index; do not keep a worse
   query merely to demonstrate a PostgreSQL 18 feature.
4. Capture hash memory/batches, sorts, buffers, and requested/launched workers.

### P1. Test extended statistics only where estimates are wrong

The live user schemas currently have zero extended-statistics objects. Optional
tenant filters contain correlated columns that may benefit, especially products
(`merchant_id`, `status`, category/brand/condition) and orders (`merchant_id`,
`branch_id`, payment/shipping status, time). Use `CREATE STATISTICS` with only the
needed dependency/MCV/NDISTINCT kinds on the clone when `EXPLAIN` shows material
estimate error. Measure planning time and plan stability; do not create broad
statistics objects speculatively. Re-run `ANALYZE` after PG18 because extended
statistics are not part of the normal retained-statistics guarantee.

### P1. Isolate blog view counters from wide content writes

`increment_blog_post_views` currently updates the wide `blog_posts` content row on
every accepted view, and the generic updated-at trigger also fires. The sampled
window contains about 10,982 anonymous calls, 126.5 MB WAL, 49,984 WAL records, and
22,001 full-page images. `blog_posts` recorded 18,128 updates, only 9,085 HOT
updates, 26 autovacuums, and 88 autoanalyzes for 901 live rows. This is the
second-largest recurring application WAL signal after analytics inserts; the larger
blog search-vector update was a one-time migration and must not be treated as steady
state.

On a restored clone, compare:

1. the current inline counter;
2. a narrow per-post or per-post/per-day metrics row; and
3. a bounded buffered/batched accumulator with an explicit flush and recovery
   contract.

Do not select a design from the counters alone. Preserve merchant/post scoping,
public abuse/rate controls, accepted view-count consistency, reporting semantics,
and cache behavior. Measure WAL bytes/records/full-page images per accepted view,
HOT percentage, autovacuum/autoanalyze frequency, row-lock contention, lost or
duplicate increments under concurrency, read/report parity, and whether content
`updated_at` remains stable when only the counter changes.

### P0. Audit index write amplification safely

The live advisors currently report 178 unused indexes and 15 unindexed foreign
keys. Neither list is an automatic migration script.

1. Export definitions, sizes, reset-bounded scan/search deltas, tuples read/fetched,
   constraint dependencies, predicate, column order, and business call sites for
   every candidate. Never compare raw PG17 and PG18 `idx_scan` counts as if their
   semantics were identical.
2. Retain indexes required for PK/unique/FK checks, RLS, idempotency, Realtime,
   webhooks, rare month-end work, or incident recovery.
3. Use `hypopg`, `index_advisor`, and forced candidate plans on a clone.
4. After PG18, use skip-scan evidence to reassess overlapping suffix indexes.
5. Drop one candidate per append-only migration with a documented recreate SQL
   and a rollback/plan regression gate.

The exact duplicate non-unique `idx_import_job_rows_job_row_number` is covered by
the unique `import_job_rows_import_job_id_row_number_key` on the same two columns.
It is the first low-risk consolidation candidate, but still requires dependency and
plan checks. Do not bulk-drop the product table's 37 indexes.

Evaluate the 15 missing foreign-key indexes by actual parent-delete/join behavior.
The currently empty repair/quiz tables are lower priority than active inventory
event relationships, but they should be fixed before growth if their access paths
need the foreign key columns.

### P1. Connection, Auth, and RLS efficiency

- Keep application traffic on transaction pooling unless a tested feature requires
  session state. Do not introduce named prepared statements that assume session
  affinity.
- Same-day samples showed 21-23 idle connections out of 24-27 total. Attribute
  them by application/service and confirm normal pool behavior before changing
  pool sizes; an idle transaction-pooled backend is not automatically a leak.
- The Auth advisor reports a fixed maximum of 10 database connections and
  recommends percentage-based allocation. Change that only as a separate Auth
  capacity task with login/signup/refresh load tests.
- Baci's 202 policies that use `auth.uid()` already wrap it in a `SELECT`, so do not
  rewrite them again.
- Review the five advisor-reported overlapping permissive policies. Prioritize the
  high-call `merchant_feature_settings` read path, while preserving intentional
  merchant, staff, customer, admin, and public semantics.

## 7. Hosted PostgreSQL 18 go/no-go gates

All gates are mandatory:

1. The authenticated eligibility payload offers `postgres_version: 18` with
   `release_channel: ga`.
2. Supabase publishes PostgreSQL 18-specific hosted upgrade notes and the Dashboard
   shows the exact target Postgres/PostgREST/platform-service bundle and target CPU
   architecture/build. If the target architecture's default `char` signedness can
   differ from the ARM64 source, written provider confirmation must cover
   `pg_upgrade --set-char-signedness` and extension compatibility.
3. PG18 eligibility returns no blocker arrays, validation errors, or unaccepted
   warnings.
4. Every installed extension has an offered, compatible PG18 build and upgrade
   path, including `vector`, `pg_net`, Vault, `pg_cron`, `pg_trgm`, `hypopg`, and
   `index_advisor`.
5. The exact hosted target is exercised on a restored copy or provider-supported
   staging clone. A normal Supabase database branch is insufficient unless its
   SQL reports the exact PG18 target build.
6. Rehearsal is pinned to the exact deployed Vercel/application commit and release,
   live migration-ledger export, and schema/function/index/policy hashes that will
   enter the freeze. A moving `origin/main` name is not an execution artifact.
7. The restored clone has matching data, ICU locale behavior, generated columns,
   RLS/grants, publications, functions, triggers, and representative statistics.
8. A complete encrypted recovery package is restore-tested. It contains the
   application roles/schema/data/history dumps, a provider physical clone that
   includes managed Auth/database state, custom-role password reset steps, and
   separate Storage objects plus Auth/Realtime/Edge/configuration artifacts.
9. The owner has approved an explicit RPO/RTO and maximum physical-backup age.
   Either enable and stabilize PITR as a separate Small-compute decision, obtain a
   provider-supported near-cutover physical recovery point, or schedule immediately
   after a completed backup and formally accept the resulting RPO.
10. No user read replica, user logical slot/subscription, unsupported `reg*` column,
    invalid index, prepared transaction, or long transaction blocks cutover.
    Transient managed Realtime activity must be accepted by eligibility or written
    Support guidance at T-0.
11. T-24h and T-0 provider metrics confirm the documented upgrade disk-headroom
    requirement, no WAL/slot retention anomaly, and acceptable CPU/I/O capacity.
    The current 347 MiB database on an 8 GB volume looks comfortable, but database
    relation size is not a substitute for total-volume/WAL metrics.
12. A provider-independent maintenance rehearsal passes with all Supabase
    connectivity deliberately blocked: custom domains and static assets still show
    maintenance, and each webhook returns its documented retryable response without
    acknowledging an uncommitted event.
13. The newly returned PG18 downtime estimate is accepted with validation and
    recovery buffer. Do not reuse the current one-hour PG17 estimate.
14. Payment-provider retry behavior and maintenance-mode handling are verified for
    each webhook before the database outage.
15. Full CI and database regression gates pass for the immutable cutover commit and
    live schema/ledger hash manifest.
16. A Supabase change ticket is pre-opened with the incident/escalation contacts,
    applicable support-plan response target, and written confirmation of the
    supported restoration path for the chosen pre-PG18 physical recovery point.

## 8. Rehearsal and benchmark design

### 8.1 Environment

- Use the same hosted PG18 build, Micro-equivalent compute, disk type, connection
  modes, extensions, checksums state chosen by Supabase, collation, and data
  snapshot as production.
- Run at least one Micro-equivalent test. An oversized clone can hide spills and
  connection/parallel-worker constraints.
- Use production-shaped concurrency and rate, not only single-session explains.
- Run warm-cache and explicitly defined buffer-cold tests. If PG18
  `pg_buffercache` eviction functions are offered, use them on the disposable clone
  only; they do not clear the operating-system cache. Never evict production cache.
- Reset statistics immediately before each isolated clone replay, then collect
  per-role deltas. Keep production statistics untouched.

### 8.2 Workload suites

1. Storefront merchant/domain resolution and public snapshot reads.
2. PDP core, preflight, semantic enrichment, variants, offers, and serialized stock.
3. Category/listing product + category/spec/variant reads, with anonymous,
   customer, owner, staff, and admin/merchant role cases reported separately.
4. Search, autocomplete, suggestion, filters, exact counts, and deep pagination.
5. Mobile dashboard, orders, customers, `get_monthly_sales_stats`, sales summaries,
   and reporting aggregates.
6. Checkout, order creation, inventory reservation/reconciliation, payment status,
   and idempotent webhook replay.
7. Auth login/signup/refresh and merchant/admin overlap access.
8. Analytics/search event inserts, retention deletes, vacuum, and WAL generation.
9. Blog listing/guide FTS, GIN/trigram index build/rebuild, and view-counter
   write/WAL/lock behavior.
10. Product-feed image projections, image ordering, cache refresh, and feed export.
11. Realtime subscription delivery, reconnect, publication, and slot behavior.
    Isolate zero, one, and multiple connected clients; subscription lifetime and
    channel churn; wallet alone versus wallet plus loyalty; and Realtime-only versus
    poll-only versus both for the migration UI. If list-change cost is invariant,
    classify it as provider-owned; if it follows subscriber/poll amplification,
    consolidate listeners or suppress fallback polling while Realtime is healthy.
12. Storage metadata reads/writes and signed/public object access.
13. Import batches and invalid-row handling.

Split plan profiling from latency measurement. For matched PG17/PG18 row, buffer,
WAL, and plan-shape evidence, use the lower-overhead execution pass:

```sql
EXPLAIN (
  ANALYZE,
  BUFFERS,
  WAL,
  SETTINGS,
  TIMING OFF,
  FORMAT JSON
)
-- representative SELECT or transaction-wrapped DML
```

On PG18, collect planner memory without execution using
`EXPLAIN (MEMORY, SETTINGS, FORMAT JSON)`. For wide JSON/PostgREST-facing results,
run repeated paired diagnostic passes with `TIMING ON, SERIALIZE NONE` and
`TIMING ON, SERIALIZE TEXT` while holding parameters and cache state fixed; timing
must be enabled for PostgreSQL to report serialization time. `EXPLAIN ANALYZE` adds
profiling overhead, so the paired difference is diagnostic only. Ordinary
non-`EXPLAIN` client requests remain the source of database, serialization,
network, pool, and application latency percentiles.

On PostgreSQL 18 also capture memory/spill details, index-search counts,
`pg_aios`, `pg_stat_io` byte/WAL rows, `pg_stat_get_backend_io()`,
`pg_stat_get_backend_wal()`, vacuum/analyze time fields, and requested/launched
parallel workers. When Supabase exposes them, also capture connection-stage and
lock-failure logs, checkpointer completed/skipped and SLRU-write counters, vacuum
cost-delay timing, full WAL-buffer counts, and parallel bitmap-worker cache
statistics. Measure and document the overhead before enabling I/O, WAL, or
cost-delay timing globally. Wrap DML explains in `BEGIN`/`ROLLBACK` and never run
unsafe payment mutations against production.

### 8.3 Versioned harness and statistical design

1. Commit the harness, seed/snapshot identifier, client/container versions,
   operation weights, SQL/HTTP payloads, expected-result assertions, role matrix,
   merchant-size tiers, parameter corpus, and cache-state recipe. Freeze that
   artifact before the A/B run.
2. Measure three layers separately: direct PostgreSQL custom-script replay using
   `pgbench`; Supavisor/PostgREST HTTP replay; and full application-route replay.
   Do not credit a database-engine change with network, pool, or application-cache
   movement seen only in a higher layer. For direct RLS cases on the clone, set the
   same transaction-scoped role and JWT claims as the corresponding API request;
   never substitute service-role execution for an authenticated/public workload.
3. Use a fixed open-loop arrival rate (`pgbench --rate` or the HTTP equivalent),
   latency limits, per-request logs, and identical expected and 2×-peak mixes.
   Run a separate closed-loop saturation test only for capacity discovery.
4. Fix anonymous/customer/owner/staff/admin proportions, small/large merchant
   proportions, exact/fuzzy/no-match/deep-page parameters, and warm/buffer-cold/
   storage-cold states. A database restart or logical restore does not prove the
   provider/OS cache is cold; a restore can warm it. Accept a “storage-cold” label
   only when provider telemetry proves physical reads, Supabase supplies a
   documented cold-storage method, or the working set exceeds every relevant cache.
   Otherwise report only buffer-cold.
5. For each release-gating cell, run a 10-minute warm-up followed by at least five
   randomized/interleaved 30-minute PG17/PG18 repetitions. Collect at least 20,000
   samples for any operation whose p99 decides approval, or mark its p99
   underpowered and extend the run.
6. Derive p50/p95/p99, errors, queue/pool acquisition time, and throughput from
   client histograms/logs—not `pg_stat_statements`, which supplies aggregate means
   and backend evidence. Correlate each run with reset-bounded server deltas.
7. Use a declared bootstrap 95% confidence interval over repeated-run differences.
   A regression gate passes only when the interval's upper bound is within the
   allowed slowdown; a claimed >=10% benefit requires the interval's lower bound to
   clear 10%. Preserve raw samples and seeds for reproduction.

### 8.4 Feature-isolation matrix

Run in this order where the managed service exposes the setting:

1. PG17 stable workload baseline.
2. PG18 with provider defaults and no Baci query changes.
3. PG18 `io_method=sync` versus default worker and available `io_uring` on the
   clone only, with the complete AIO setting set recorded and `pg_aios` sampled
   during load. Enable I/O timing only after measuring its overhead on the clone.
4. For queries that newly qualify, run clone-only negative controls with
   `SET LOCAL enable_self_join_elimination = off` and
   `SET LOCAL enable_distinct_reordering = off` to attribute the new planner
   transformations and isolate regressions.
5. One opt-in feature/configuration change at a time.
6. PG18 plus each Baci query/index change separately.
7. Final mixed workload at expected and 2× peak concurrency.

More AIO or parallelism can improve throughput while worsening tail latency. Both
must pass.

## 9. Compatibility and preflight work

### 9.1 PostgreSQL 18 behavior changes

- New generated columns default to virtual. Make all future definitions explicit.
- Time-zone abbreviations now prefer the current session's abbreviations before
  `timezone_abbreviations`. Include abbreviated input, cron, order, payment, and
  report boundary cases in the time-zone regression corpus.
- `VACUUM`/`ANALYZE` parent targets now include inheritance children unless `ONLY`
  is specified. Review maintenance scripts.
- CSV `COPY FROM` changes `\.` handling; upgrade operational `psql`/CLI clients.
- Deferred `AFTER` triggers run as the role active when the event was queued.
- Unlogged partitioned tables are disallowed.
- `pg_backend_memory_contexts.parent` is removed and `level` becomes one-based.
- WAL I/O fields move from `pg_stat_wal` to `pg_stat_io`.
- Query-ID computation changes; compare normalized business operations, not raw IDs.
- MD5 password authentication is deprecated. Current observed custom login roles
  use SCRAM; recheck future roles.
- Primary/foreign-key relationships must use deterministic collations or the same
  nondeterministic collation. Inventory collations on all linked key columns even
  if the future eligibility check is clean.
- `NOT NULL` metadata representation changes in PG18. Version-aware schema diffing
  must compare semantics rather than treating expected catalog/dump formatting as
  drift.
- PG18 enables checksums by default for new clusters, but `pg_upgrade` needs source
  and target checksum settings to match. Current Baci checksums are off; Supabase
  must own the matching target-cluster initialization.
- The source build is ARM64. Record the target architecture and default `char`
  signedness; block any cross-architecture upgrade unless Supabase certifies its
  `--set-char-signedness` handling and the entire extension/service bundle on that
  target.

### 9.2 ICU full-text/trigram requirement

Baci's database locale provider is ICU, and Baci actively uses full-text and
`pg_trgm` indexes. PostgreSQL 18 changes text-search configuration/dictionary
behavior to follow the cluster default collation provider instead of always libc.

Before cutover:

1. Generate a complete inventory of indexes whose definitions or operator classes
   use `tsvector`, GIN FTS, `gin_trgm_ops`, or text-search expressions.
2. Run ranking/result-parity tests on PG18 with merchant names, brands, categories,
   punctuation, accents, Nigerian names, device models, exact SKUs, and known typo
   cases.
3. Prepare an out-of-transaction reindex runbook. While affected reads/writes are
   closed in maintenance, prefer standard non-concurrent `REINDEX`: concurrent mode
   performs two scans, waits across transactions, and is usually slower. Reserve
   `CONCURRENTLY` for a separately justified availability requirement.
4. Include at minimum the current product search-name/document/vector/trigram/SKU
   indexes and blog search-vector/title-trigram indexes, but generate the final list
   from the live target rather than trusting this document.
5. On the PG18 rehearsal target, compare serial versus parallel GIN rebuilds and
   record `max_parallel_maintenance_workers`, requested/actual workers, CPU, I/O,
   temporary/disk headroom, blocking, and elapsed time.
6. Rebuild affected indexes before permitting search reads. When Supabase offers
   PG18 `amcheck`, run the applicable B-tree/GiST/GIN checks, including
   `gin_index_check()` for GIN, then perform the full `ANALYZE` phase and compare
   result order as well as latency.

Do not place any `REINDEX` operation inside a normal transactional Supabase
migration. Run it as an approved operations step with exact before/after inventory.

### 9.3 Extension and service bundle

Capture and compare before/rehearsal/after:

- `pg_extension` installed and available versions;
- PostgREST release notes, exposed schemas, max rows, pool and acquire timeout;
- Auth, Realtime, Storage, Supavisor, and PgBouncer versions/configuration;
- Edge Functions and cron schedules;
- publications and platform-managed Realtime slots;
- function signatures, volatility, `SECURITY DEFINER`, search paths, grants, and
  PostgREST schema cache behavior.

## 10. Backup, maintenance, and rollback strategy

### 10.1 Before the window

1. Pin the Supabase CLI version used successfully in rehearsal; do not use a
   floating `latest`. At planning time the installed CLI is 2.95.4 while 2.109.1 is
   available, so the installed binary is not automatically the cutover binary.
2. Produce encrypted, access-controlled logical artifacts with the rehearsed
   version. The command manifest is:

   ```bash
   export SUPABASE_CLI_VERSION='<rehearsed-version>'
   export BACKUP_DIR='<encrypted-backup-directory>'
   export APPLICATION_SCHEMAS='public,private'

   pnpm dlx "supabase@${SUPABASE_CLI_VERSION}" db dump --linked \
     --role-only --file "${BACKUP_DIR}/roles.sql"
   pnpm dlx "supabase@${SUPABASE_CLI_VERSION}" db dump --linked \
     --schema "${APPLICATION_SCHEMAS}" \
     --file "${BACKUP_DIR}/application-schema.sql"
   pnpm dlx "supabase@${SUPABASE_CLI_VERSION}" db dump --linked \
     --schema "${APPLICATION_SCHEMAS}" --data-only --use-copy \
     --file "${BACKUP_DIR}/application-data.sql"
   pnpm dlx "supabase@${SUPABASE_CLI_VERSION}" db dump --linked \
     --schema supabase_migrations --data-only --use-copy \
     --file "${BACKUP_DIR}/migration-history-data.sql"
   pnpm dlx "supabase@${SUPABASE_CLI_VERSION}" db dump --linked \
     --schema auth,storage --file "${BACKUP_DIR}/managed-schema.sql"
   pnpm dlx "supabase@${SUPABASE_CLI_VERSION}" db dump --linked \
     --schema auth,storage --data-only --use-copy \
     --file "${BACKUP_DIR}/managed-data.sql"
   ```

   Generate `APPLICATION_SCHEMAS` from the live user-owned schema inventory; the
   current value is `public,private`, but do not assume that remains complete. An
   unscoped `--data-only` dump includes `auth` and `storage` data in the checked CLI
   versions and would overlap `managed-data.sql`. Run every final command first with
   `--dry-run`, save the generated include/exclude command manifest, and fail if the
   scopes overlap. Supabase CLI's default schema dump excludes managed `auth`,
   `storage`, and extension schemas and contains neither data nor custom roles. The
   explicit managed dumps are sensitive diagnostic/partial-recovery artifacts;
   restore them only through the exact rehearsed Supabase procedure because a fresh
   project already owns managed schemas.

   For logical PG18 rehearsal clones, also use the pinned PostgreSQL 18 client over
   the approved direct connection to capture optimizer statistics, which normal
   dumps exclude:

   ```bash
   pg_dump --dbname "${DIRECT_DATABASE_URL}" \
     --schema public --schema private --statistics-only \
     --file "${BACKUP_DIR}/planner-statistics.sql"
   ```

   Treat this as an encrypted performance/rehearsal artifact, restore it only after
   the matching schema/data, and still run the full post-upgrade `ANALYZE` sequence.
   It is not a substitute for the provider physical recovery point.
3. Hash the encrypted artifact set and record the CLI/container versions, dry-run
   manifests, commands,
   start/end timestamps, source project/build, row counts, and exclusions. Never
   print database passwords or backup contents into CI logs.
4. Restore-test application artifacts and, separately, restore a provider physical
   backup/clone that includes managed database and Auth state. Compare critical row
   counts, constraints, definitions, and deterministic checksums.
5. Inventory login roles and rehearse resetting any custom-role password from the
   secret manager. Supabase physical/daily backups do not preserve custom-role
   passwords. Do not store password values in this plan or the dump manifest.
6. Decide the maximum acceptable backup age/RPO. Confirm a physical recovery point
   within it immediately before cutover, or complete the separately approved
   Small-compute/PITR path and let it stabilize before this window.
7. Export Storage object bytes and metadata inventory and verify a separate restore
   path; database backups contain metadata but not object bytes. Also export the
   manual-reconfiguration manifest for Edge Functions and secrets, Auth providers
   and redirect URLs, SMTP, API keys, Realtime settings, custom domains, extensions,
   and database settings.
8. Export the exact deployed application/Vercel release, migration ledger,
   extension, grants, policies, functions, triggers, cron, publications, indexes,
   table counts, schema hashes, and performance baselines.
9. Freeze schema deploys and payment/order/inventory changes for the window.
10. Rehearse provider-independent maintenance by blocking all Supabase endpoints.
    Custom domains and static assets must still render maintenance without merchant
    resolution, PostgREST, Auth, or Storage.
11. Publish customer/merchant maintenance communication.
12. Pause/drain nonessential live `pg_cron`, Vercel cron, VPS workers, Realtime
    consumers, imports, AI workers, and Edge Function writers. Active-job counts are
    dynamic, so use T-24h/T-0 inventories rather than the planning snapshot.
13. Define and rehearse how each payment webhook returns a provider-specific
    retryable response without acknowledging an uncommitted payment. Confirm retry
    schedules and idempotency for Paystack, Korapay, Kuda, Credit Direct, and every
    currently enabled rail.
14. Open the Supabase change ticket and attach the recovery-point identifier,
    escalation contacts, support response target, and written restore route.

The provider physical recovery point is the sole point-in-time-consistent rollback
source. Pre-freeze logical dumps are forensic/selective-recovery artifacts, not an
atomic replacement for it. The final data, migration-history, row-count, and hash
captures must be repeated after the definitive write freeze and transaction drain.

### 10.2 Cutover

1. Enable the approved maintenance/write-freeze mechanism without editing
   `proxy.ts` unless separately approved. The response must use the rehearsed
   provider-independent path and must not query Supabase to decide maintenance.
2. Drain or finish in-flight writes; verify no long transaction or prepared
   transaction remains.
3. With writers blocked, repeat the scoped application/managed data and migration
   history dumps, live inventory, row counts, and hashes. Persist their start/end
   times and verify no intervening application job or transaction. Managed-service
   writes that cannot be fully frozen are another reason the physical recovery
   point remains authoritative.
4. Re-run PG18 eligibility and capture the payload and Dashboard estimate.
   Re-query `pg_replication_slots`, `pg_subscription`, and `pg_stat_replication` and
   compare the immutable deployment/ledger/schema manifest.
5. Start the upgrade from Supabase Dashboard.
6. Expect the database and associated Supabase services to be offline and all
   existing pooler/direct connections to drop.
7. If Supabase reports upgrade failure, let the platform restore the original
   instance, keep writes closed, and follow the PG17 fallback gates below; do not
   improvise a manual downgrade.
8. If the upgrade succeeds, keep application writes closed while the database and
   service validation, required reindex, analyze, and smoke gates run.

### 10.3 PG18 success reopen gates

- `version()` and server build are the expected GA PG18 target.
- Every extension is present at the rehearsed version.
- Locale, checksums, settings, connection modes, and service versions match the
  approved target facts.
- All critical tables/counts, PK/FK/unique constraints, indexes, generated columns,
  functions, grants, RLS policies, triggers, publications, cron jobs, and schema
  cache entries are valid.
- Supabase proves an equivalent of the complete PG18 post-upgrade sequence, using
  a worker count rehearsed for the two-core target rather than an arbitrary maximum:

  1. `vacuumdb --all --analyze-in-stages --missing-stats-only --jobs=N`;
  2. the required FTS/trigram and other incompatible index rebuilds; and
  3. `vacuumdb --all --analyze-only --jobs=N`.

  Extended/custom statistics and newly rebuilt indexes must have current evidence;
  retained ordinary statistics alone do not satisfy this gate.
- Auth, public storefront, dashboard, mobile, checkout, order, payment, webhook,
  inventory, Realtime, and Storage smoke tests pass.
- A short production-shaped load test passes with no p95/p99, connection, lock,
  temp-spill, or error regression.
- Only then reopen writes and resume jobs incrementally.

### 10.4 Automatic PG17 fallback reopen gates

If the Dashboard operation fails and Supabase automatically restores the original
instance, the expected version is the immutable recorded PG17 source build—not
PG18. Keep maintenance enabled until all of these pass:

- `version()` and the Supabase Postgres build equal the recorded PG17 source;
- PostgREST, Auth, Realtime, Storage, Supavisor/PgBouncer, extensions, locale,
  checksums, connection modes, and settings match the source manifest;
- critical data counts/checksums, roles/grants/RLS, functions, triggers, indexes,
  publications, migration history, cron, and schema-cache behavior are intact;
- Tier-0 Auth, storefront, checkout, payment, webhook, order, inventory, Realtime,
  and Storage smoke tests pass under the original PG17 acceptance baseline;
- queued provider webhooks are replayed idempotently, then paused cron, VPS, import,
  AI, Realtime, and other jobs resume in a controlled order; and
- the failed-upgrade incident and evidence are retained before a new attempt.

### 10.5 Provider restore after a successful upgrade but failed smoke gate

If PG18 completes but a pre-reopen smoke gate fails and Supabase restores the
captured recovery point, do not assume the result is the original in-place PG17
project. The written Support route may restore in place or to another project and
may expose a PG17 or roll-forward PG18 bundle. Keep maintenance enabled and:

1. discover and record the actual project reference, region, engine/build,
   architecture, endpoints, service bundle, poolers, locale, checksums, extensions,
   and recovery-point timestamp;
2. reconcile database, Auth users/identities, Storage metadata and separately
   restored object bytes, custom-role credentials, Vault/secrets, API keys, Auth
   providers/redirects, SMTP, Realtime, Edge Functions, cron, custom domains, and
   every application/provider connection target;
3. prove critical row counts/checksums, constraints, schema/ledger hashes, grants,
   RLS, functions, triggers, indexes, publications, and object inventory against the
   recovery manifest;
4. quantify data loss from the recovery-point timestamp against the approved RPO
   and obtain the named business owner's acceptance before reopening;
5. run the PG17 fallback baseline above if the discovered target is PG17, or the
   PG18 success baseline if it is PG18, including the required analyze/reindex state;
   and
6. replay queued webhooks idempotently, reconcile payment/order/inventory events,
   then resume jobs incrementally only after application routes use the verified
   restored endpoints.

### 10.6 Rollback reality

Supabase documents automatic fallback when the upgrade operation itself fails. It
does not document an in-place PostgreSQL 18-to-17 downgrade after a technically
successful upgrade.

- Before writes reopen: a failed smoke gate is an abort. Keep maintenance mode,
  invoke the pre-opened Supabase escalation and choose the written provider
  restore/recovery path tied to the captured recovery point, then use the
  version-aware provider-restore gates above.
- After PG18 accepts writes: prefer roll-forward. Restoring PG17 or a pre-upgrade
  backup loses post-cutover writes unless a separate reverse-replication path was
  rehearsed; this plan does not assume one.
- Define the business-approved RPO/RTO and authority to restore before cutover.

## 11. Post-upgrade exploitation sequence

Do not enable every feature during cutover.

### First 24 hours: defaults only

- Verify `io_method`, I/O combine and effective/maintenance concurrency, AIO
  workers, parallel settings, vacuum settings, extension versions, and preserved
  planner statistics; do not copy PG17 I/O defaults blindly onto PG18.
- Watch errors, locks, CPU, IOPS, throughput, temp bytes, WAL, connections, Realtime
  lag, and Tier-0 p95/p99.
- Verify the staged missing-statistics/reindex/full-`ANALYZE` sequence completed
  before reopen; after that, use targeted `ANALYZE` only for newly observed drift.
- Roll forward query-plan regressions one at a time.

### Days 2-7: query and index proof

- Compare normalized workload deltas.
- Validate skip scans and OR/IN planner improvements.
- Re-evaluate overlapping indexes only after sufficient usage evidence.
- Land the suggestion/query/temp-spill work as independent PRs if not already done.
- Tune targeted memory/vacuum settings only from telemetry.

### Weeks 2-4: opt-in pilots

1. Pilot `uuidv7()` for new `analytics_events` rows with realistic concurrent
   writers; compare insert p95/p99, WAL, buffer writes, index size, and rightmost-page
   contention. Use clone-only `pgstattuple`/`pgstatindex` if Supabase offers
   `pgstattuple`; otherwise do not claim page-density evidence. Do not rewrite old
   IDs or install a production extension solely for the experiment.
2. Audit `RETURNING OLD/NEW` round-trip eliminations in inventory/order/payment
   functions.
3. Benchmark the three non-indexed arithmetic stored generated columns as virtual
   on a clone; for each, inventory publication membership, column lists, Realtime
   consumers, and expected payloads. Retain `STORED` if the generated value must be
   logically replicated, and adopt only if write gains exceed read cost with payload
   parity.
4. Evaluate Auth percentage-based connection allocation under load.
5. Consider per-table vacuum controls for analytics/push/import churn.

### Future growth gates

- Do not partition `analytics_events` at 101k rows. Reconsider native time
  partitioning when row count, retention deletes, vacuum duration, or bounded date
  scans demonstrate a real need, normally at tens/hundreds of millions of rows.
- Do not globally enable partitionwise joins/aggregates on Micro.
- Do not adopt `PG_UNICODE_FAST` for natural storefront sort order without a full
  semantic and index migration design.

## 12. Delivery and validation structure

Keep the work in small, attributable changes:

1. **Baseline/observability artifact:** read-only scripts and saved baseline output.
2. **PG17 no-regret search PR:** suggestion candidate/index-use fix and tests.
3. **PG17 fanout/query-shape PRs:** one business operation per PR.
4. **Index/FK PRs:** one reviewed group with recreate SQL and plan evidence.
5. **PG18 compatibility PR:** monitoring queries, explicit generated-column
   declarations, operational runbooks, and tests; no engine upgrade.
6. **Hosted PG18 rehearsal report:** exact bundle, benchmark, blockers, rollback
   proof, and signed go/no-go.
7. **Production cutover:** Dashboard operation plus the frozen runbook.
8. **Post-upgrade feature PRs:** UUIDv7, OLD/NEW, virtual columns, and tuning as
   separate measured pilots.

For every code or migration PR:

- append a new migration; never edit an existing migration;
- add colocated tests for modified runtime code and migration regression tests;
- compile/check SQL against a disposable/restored target first;
- run focused tests, `pnpm turbo lint`, `pnpm turbo typecheck`, and relevant
  `pnpm turbo test` scopes;
- run the required uncommitted CodeRabbit review before commit;
- do not run a Vercel cloud build; use the repository's prebuilt/VPS flow only
  when deployment is separately authorized.

## 13. Risk register

| Risk | Prevention and response |
| --- | --- |
| PG18 not available on hosted Supabase | Hard eligibility gate; readiness work only today |
| AIO appears enabled but issues no asynchronous reads | Verify the full AIO setting set, sample `pg_aios` during load, and correlate physical I/O; label the benefit unavailable rather than inventing uplift |
| Planner regression on small/cache-hot tables | Clone replay, row parity, p95/p99 gates, complete post-upgrade analyze sequence followed by targeted `ANALYZE` where evidence requires it, roll-forward plan |
| ICU text-search/trigram semantic drift | Full inventory, PG18 ranking corpus, reindex, result-order tests |
| Extension or bundled-service incompatibility | Exact hosted target matrix and rehearsal; no generic upstream-only approval |
| Post-success downgrade is unavailable | Keep writes closed through smoke; use the version-aware provider-restore branch; define RPO/RTO |
| PITR is off | Provider physical recovery point within the approved RPO plus scoped forensic logical artifacts; decide PITR separately |
| Storage omitted from DB backup | Separate object inventory/recovery rehearsal |
| Payment event arrives during outage | Verified retryable responses and provider idempotent replay; never acknowledge before commit |
| Stats falsely compare old and new code | Delta snapshots by normalized business operation; no raw query-ID comparison |
| Bulk index deletion damages rare/RLS paths | 30-day evidence, dependency/call-site audit, HypoPG, one-at-a-time migrations |
| Global `work_mem`/parallel tuning exhausts Micro | Query-shape first; per-session experiments; mixed concurrency load test |
| UUIDv7 treated as a secret or mass rewrite | New-row pilot only; authorization never depends on ID unpredictability |
| Managed Realtime slots are manually removed | Leave platform slots alone; use eligibility and Supabase Support |

## 14. Rereview and convergence record

This plan was challenged in repeated passes before being marked complete:

1. **Official PostgreSQL 18 completeness pass:** classified automatic planner,
   executor, AIO, vacuum, index-build, observability, replication, CPU, and upgrade
   improvements; added current-minor and compatibility requirements.
2. **Hosted Supabase feasibility pass:** found the decisive no-GA-PG18 blocker,
   separated the PG17 one-hour estimate, captured the exact live bundle, and made
   extension/service eligibility mandatory.
3. **Live Baci workload pass:** mapped PG18 features to current search, PDP, semantic
   guide, dashboard, order, analytics, index, RLS, pool, and temp-spill evidence.
4. **Measurement-skeptic pass:** rejected cumulative query means as release SLOs,
   rejected blanket “3×” AIO claims, and required normalized delta/replay evidence.
5. **Operations/rollback pass:** added PITR/Storage limitations, payment-webhook
   freeze behavior, managed-slot handling, and the absence of a post-success
   in-place downgrade.
6. **Over-optimization pass:** rejected premature analytics partitioning, global
   memory/parallel changes, conversion of indexed search columns to virtual, mass
   UUID rewrites, and bulk unused-index drops.
7. **Hostile benchmark/engine pass:** added a versioned multi-layer open-loop
   harness, confidence rules, reset-safe/index-search telemetry, complete post-upgrade
   statistics sequence, true AIO activation and cold-state proof, reindex strategy,
   serialization diagnostics, and planner negative controls.
8. **Hostile recovery pass:** removed overlapping dump scopes, made the provider
   physical point authoritative, repeated artifacts after write drain, and added
   distinct automatic-fallback and version-aware provider-restore reopen branches.
9. **Second live workload pass:** found and mapped the authenticated catalog RLS
   cliff, blog view-counter WAL amplification, and Realtime subscriber/polling
   isolation; it then returned no further repository-backed opportunity.
10. **Final convergence pass:** independent PostgreSQL, Supabase-hosted operations,
    and Baci workload reviewers reread the current artifact. All three returned no
    new actionable performance benefit, correctness gap, or unsupported priority.

The remaining performance surface is intentionally classified into four buckets:

- automatic PostgreSQL 18 engine/planner gains;
- provider/configuration-controlled gains;
- Baci query/schema/index opportunities;
- provider/build-only or future-growth features.

No item is allowed to count as a Baci performance benefit until its activation
state and workload-specific measurement are confirmed.

“No further benefit found” means no additional evidence-backed item remained in the
official PostgreSQL 18 release surface, current hosted constraints, current Baci
source, or live workload evidence reviewed on 2026-07-12. Future PostgreSQL 18 minor
releases, Supabase bundle notes, and workload growth must reopen this review.

## 15. Primary references

- [PostgreSQL 18 release notes](https://www.postgresql.org/docs/18/release-18.html)
- [PostgreSQL 18.4 release notes](https://www.postgresql.org/docs/release/18.4/)
- [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/)
- [PostgreSQL 18 resource/AIO settings](https://www.postgresql.org/docs/18/runtime-config-resource.html)
- [PostgreSQL 18 asynchronous-I/O activity](https://www.postgresql.org/docs/18/view-pg-aios.html)
- [PostgreSQL 18 pg_buffercache](https://www.postgresql.org/docs/18/pgbuffercache.html)
- [PostgreSQL 18 replication settings](https://www.postgresql.org/docs/18/runtime-config-replication.html)
- [PostgreSQL 18 multicolumn indexes and skip scan](https://www.postgresql.org/docs/18/indexes-multicolumn.html)
- [PostgreSQL 18 generated columns](https://www.postgresql.org/docs/18/ddl-generated-columns.html)
- [PostgreSQL 18 EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html)
- [PostgreSQL 18 pgbench](https://www.postgresql.org/docs/18/pgbench.html)
- [PostgreSQL 18 monitoring statistics](https://www.postgresql.org/docs/18/monitoring-stats.html)
- [PostgreSQL 18 pg_stat_statements](https://www.postgresql.org/docs/18/pgstatstatements.html)
- [PostgreSQL 18 REINDEX](https://www.postgresql.org/docs/18/sql-reindex.html)
- [PostgreSQL 18 COPY](https://www.postgresql.org/docs/18/sql-copy.html)
- [PostgreSQL 18 amcheck](https://www.postgresql.org/docs/18/amcheck.html)
- [PostgreSQL 18 pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html)
- [PostgreSQL 18 pg_upgrade](https://www.postgresql.org/docs/18/pgupgrade.html)
- [PostgreSQL 18 UUID functions](https://www.postgresql.org/docs/18/functions-uuid.html)
- [Supabase hosted project upgrades](https://supabase.com/docs/guides/platform/upgrading)
- [Supabase backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI database dump](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Supabase compute and disk](https://supabase.com/docs/guides/platform/compute-and-disk)
- [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase extensions](https://supabase.com/docs/guides/database/extensions)
