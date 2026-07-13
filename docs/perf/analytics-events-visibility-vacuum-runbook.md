# Analytics Events Visibility-Vacuum Runbook

## Scope

The mobile dashboard counts `page_view` rows by `merchant_id`, `event_type`,
and `created_at`. The existing
`idx_analytics_events_merchant_type_created` index already matches that access
path, but index-only scans still visit the heap when recently inserted pages
have not been marked all-visible.

Migration `20260713142000_tune_analytics_events_visibility_vacuum.sql` lowers
the table-local autovacuum triggers so visibility-map maintenance happens more
often. It does not change query results, retention, RLS, writers, or the
dashboard RPC. In particular, page-view semantics remain:

- `event_type = 'page_view'`;
- merchant-scoped;
- `created_at >= start` for a bounded range;
- all retained rows when the start is null;
- no branch, distinct-event, `event_timestamp`, or end-date filter.

This migration and the dashboard aggregate rewrite are independent and may be
merged or deployed in either order. Do not add the dashboard RPC definition to
this migration.

## Trigger Change

At the observed 101,460-row production size, the approximate triggers become:

| Maintenance | Before | After |
| --- | ---: | ---: |
| Insert vacuum | `1000 + 0.20 * rows` = 21,292 | `1000 + 0.01 * rows` = 2,015 |
| Dead-row vacuum | `50 + 0.05 * rows` = 5,123 | `50 + 0.02 * rows` = 2,079 |

The analyze scale remains `0.02`. These thresholds are intentionally scoped to
`public.analytics_events`; no cluster-wide setting changes.

These calculations use PostgreSQL 17 semantics. [PostgreSQL 18 multiplies the
table-tuple scale component by the fraction of table pages that are not
all-frozen](https://www.postgresql.org/docs/18/routine-vacuuming.html#AUTOVACUUM).
At the PostgreSQL 18 upgrade gate, re-measure the effective cadence and
ingestion p95 before carrying this override forward unchanged.

## Deployment

1. Apply the migration normally. The `ALTER TABLE ... SET (...)` operation is
   short and does not rewrite the table. A transaction-local five-second lock
   timeout makes a conflicting maintenance/DDL lock fail the migration; the
   deployment wrapper rolls back without recording it, so a later deployment
   can retry. Ordinary row reads and writes do not conflict with this lock mode.
2. Confirm the four reloptions with the contract test:

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
     -f supabase/tests/analytics_events_visibility_vacuum_contract.sql
   ```

3. An authorized operator may run this once, outside a transaction, during a
   low-traffic window to realize the initial visibility benefit immediately:

   ```sql
   VACUUM (ANALYZE, TRUNCATE FALSE) public.analytics_events;
   ```

   Do not place `VACUUM` in a migration. The reloptions affect future automatic
   maintenance; applying them alone does not retroactively mark heap pages
   all-visible.

## Before-and-After Evidence

Capture these read-only snapshots immediately before and after the one-time
vacuum:

```sql
SELECT
  relation.relpages,
  relation.relallvisible,
  round(
    100 * relation.relallvisible::numeric / nullif(relation.relpages, 0),
    2
  ) AS all_visible_percent,
  stats.n_live_tup,
  stats.n_dead_tup,
  stats.n_ins_since_vacuum,
  stats.last_autovacuum,
  stats.autovacuum_count
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS namespace
  ON namespace.oid = relation.relnamespace
LEFT JOIN pg_catalog.pg_stat_all_tables AS stats
  ON stats.relid = relation.oid
WHERE namespace.nspname = 'public'
  AND relation.relname = 'analytics_events';
```

For the busiest merchant, record `EXPLAIN (ANALYZE, BUFFERS)` for today, week,
month, and all-time. Use the exact same merchant and timestamps on both runs:

```sql
-- Repeat with the fixed today/week/month start timestamp.
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM public.analytics_events AS event
WHERE event.merchant_id = '<merchant-id>'::uuid
  AND event.event_type = 'page_view'
  AND event.created_at >= '<start-at>'::timestamptz;

-- Null-start/all-time path.
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM public.analytics_events AS event
WHERE event.merchant_id = '<merchant-id>'::uuid
  AND event.event_type = 'page_view';
```

Accept the rollout when:

- bounded ranges use `idx_analytics_events_merchant_type_created` as an
  index-only scan with merchant, event type, and start bound in `Index Cond`;
- all-time uses an index-only scan with merchant and event type in `Index Cond`;
  record the chosen index rather than requiring the bounded-range index;
- `relallvisible / relpages` is at least 90%;
- heap fetches are no more than 5% of rows emitted by the index-only scan;
- all four ranges improve without a latency regression;
- `autovacuum_count` and `last_autovacuum` advance under continued ingestion;
- analytics ingestion p95 latency has no material regression.

The production snapshot that motivated this change was 48.51% all-visible. A
seven-day count took 13.728 ms with 13,288 heap fetches for 14,438 rows, and an
all-time count took 244.519 ms with 52,331 heap fetches for 83,428 rows. Treat
those as a dated baseline, not a permanent service-level objective.

A local PostgreSQL 17.6 benchmark used 102,000 append-only rows with the same
covering-index shape. `VACUUM (ANALYZE)` changed the seven-day count from 4.734
ms, 932 buffers, and 6,611 heap fetches to 1.058 ms, 51 buffers, and zero heap
fetches (4.47x faster). The all-time count changed from a 44.348 ms sequential
scan over 11,334 buffers to an 11.761 ms index-only scan over 611 buffers (3.77x
faster). This demonstrates the available visibility-map benefit; production
acceptance still depends on the before-and-after gates above.

A separate local contention check held an access-exclusive lock: the migration
failed on its lock timeout in 4.79 seconds, then applied successfully on retry.
The reloptions change held `ShareUpdateExclusiveLock`; a concurrent
`RowExclusiveLock` succeeded, confirming ordinary writers remain compatible.

If visibility stays above 90% but all-time latency still exceeds the agreed
budget, re-evaluate a hybrid pre-aggregation design. Do not pre-aggregate first:
arbitrary local-day boundaries, backfills, retention deletes, and concurrent
upserts require a separate correctness and locking design.

## Rollback

If maintenance load or ingestion latency regresses, restore the prior
table-local values:

```sql
ALTER TABLE public.analytics_events SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE public.analytics_events RESET (
  autovacuum_vacuum_insert_threshold,
  autovacuum_vacuum_insert_scale_factor
);
```

Rollback changes future scheduling only; it does not undo a completed vacuum.
