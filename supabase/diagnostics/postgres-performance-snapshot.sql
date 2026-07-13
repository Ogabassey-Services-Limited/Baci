-- Read-only PostgreSQL 17 performance snapshot for encrypted operator export.
-- Run the complete script in one session; the final row is the JSON snapshot.
-- Statement text is raw evidence and must never be committed or stored unencrypted.

BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '5s';
SET LOCAL timezone = 'UTC';
SET LOCAL DateStyle = 'ISO, MDY';

WITH capture AS (
  SELECT
    clock_timestamp() AS captured_at,
    current_database() AS database_name,
    pg_postmaster_start_time() AS postmaster_started_at,
    current_setting('server_version') AS server_version,
    current_setting('server_version_num') AS server_version_num,
    version() AS server_build
),
database_stats AS (
  SELECT
    stats_reset::text AS stats_reset,
    xact_commit::text AS xact_commit,
    xact_rollback::text AS xact_rollback,
    blks_read::text AS blks_read,
    blks_hit::text AS blks_hit,
    tup_returned::text AS tup_returned,
    tup_fetched::text AS tup_fetched,
    tup_inserted::text AS tup_inserted,
    tup_updated::text AS tup_updated,
    tup_deleted::text AS tup_deleted,
    conflicts::text AS conflicts,
    temp_files::text AS temp_files,
    temp_bytes::text AS temp_bytes,
    deadlocks::text AS deadlocks,
    blk_read_time::text AS blk_read_time,
    blk_write_time::text AS blk_write_time,
    sessions::text AS sessions,
    sessions_abandoned::text AS sessions_abandoned,
    sessions_fatal::text AS sessions_fatal,
    sessions_killed::text AS sessions_killed,
    numbackends::text AS current_backends
  FROM pg_stat_database
  WHERE datname = current_database()
),
statement_info AS (
  SELECT
    stats_reset::text AS stats_reset,
    dealloc::text AS dealloc
  FROM extensions.pg_stat_statements_info
),
io_boundary AS (
  SELECT
    CASE
      WHEN count(DISTINCT stats_reset) = 1 THEN min(stats_reset)::text
      ELSE NULL
    END AS stats_reset
  FROM pg_stat_io
),
wal_stats AS (
  SELECT
    stats_reset::text AS stats_reset,
    wal_records::text AS wal_records,
    wal_fpi::text AS wal_fpi,
    wal_bytes::text AS wal_bytes,
    wal_buffers_full::text AS wal_buffers_full
  FROM pg_stat_wal
),
statement_rows AS (
  SELECT
    database_role.datname AS database_name,
    database_role.rolname AS role_name,
    statements.toplevel,
    statements.query,
    statements.stats_since::text AS stats_since,
    statements.calls::text AS calls,
    statements.plans::text AS plans,
    statements.total_plan_time::text AS total_plan_time,
    statements.total_exec_time::text AS total_exec_time,
    statements.rows::text AS rows,
    statements.shared_blks_hit::text AS shared_blks_hit,
    statements.shared_blks_read::text AS shared_blks_read,
    statements.local_blks_hit::text AS local_blks_hit,
    statements.local_blks_read::text AS local_blks_read,
    statements.temp_blks_read::text AS temp_blks_read,
    statements.temp_blks_written::text AS temp_blks_written,
    statements.shared_blk_read_time::text AS blk_read_time,
    statements.shared_blk_write_time::text AS blk_write_time,
    statements.local_blk_read_time::text AS local_blk_read_time,
    statements.local_blk_write_time::text AS local_blk_write_time,
    statements.temp_blk_read_time::text AS temp_blk_read_time,
    statements.temp_blk_write_time::text AS temp_blk_write_time,
    statements.wal_records::text AS wal_records,
    statements.wal_fpi::text AS wal_fpi,
    statements.wal_bytes::text AS wal_bytes
  FROM extensions.pg_stat_statements AS statements
  JOIN LATERAL (
    SELECT
      pg_database.datname,
      pg_roles.rolname
    FROM pg_database
    JOIN pg_roles ON pg_roles.oid = statements.userid
    WHERE pg_database.oid = statements.dbid
  ) AS database_role ON true
  WHERE database_role.datname = current_database()
    AND (statements.calls > 0 OR statements.plans > 0)
    AND (
      statements.query IS NULL
      OR (
        statements.query NOT ILIKE '%extensions.pg_stat_statements%'
        AND statements.query NOT IN (
          'BEGIN',
          'ROLLBACK',
          'SET TRANSACTION READ ONLY',
          'SET LOCAL statement_timeout = ''120s''',
          'SET LOCAL lock_timeout = ''5s''',
          'SET LOCAL timezone = ''UTC''',
          'SET LOCAL DateStyle = ''ISO, MDY'''
        )
      )
    )
),
table_rows AS (
  SELECT
    schemaname AS schema_name,
    relname AS table_name,
    seq_scan::text AS seq_scan,
    seq_tup_read::text AS seq_tup_read,
    idx_scan::text AS idx_scan,
    idx_tup_fetch::text AS idx_tup_fetch,
    n_tup_ins::text AS n_tup_ins,
    n_tup_upd::text AS n_tup_upd,
    n_tup_del::text AS n_tup_del,
    n_tup_hot_upd::text AS n_tup_hot_upd,
    n_live_tup::text AS n_live_tup,
    n_dead_tup::text AS n_dead_tup,
    vacuum_count::text AS vacuum_count,
    autovacuum_count::text AS autovacuum_count,
    analyze_count::text AS analyze_count,
    autoanalyze_count::text AS autoanalyze_count,
    pg_table_size(relid)::text AS table_bytes,
    pg_indexes_size(relid)::text AS indexes_bytes,
    pg_total_relation_size(relid)::text AS total_bytes
  FROM pg_stat_user_tables
),
index_rows AS (
  SELECT
    schemaname AS schema_name,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan::text AS idx_scan,
    idx_tup_read::text AS idx_tup_read,
    idx_tup_fetch::text AS idx_tup_fetch,
    pg_relation_size(indexrelid)::text AS index_bytes
  FROM pg_stat_user_indexes
),
io_rows AS (
  SELECT
    backend_type,
    object,
    context,
    reads::text AS reads,
    read_time::text AS read_time,
    writes::text AS writes,
    write_time::text AS write_time,
    writebacks::text AS writebacks,
    writeback_time::text AS writeback_time,
    extends::text AS extends,
    extend_time::text AS extend_time,
    hits::text AS hits,
    evictions::text AS evictions,
    reuses::text AS reuses,
    fsyncs::text AS fsyncs,
    fsync_time::text AS fsync_time
  FROM pg_stat_io
),
connection_rows AS (
  SELECT
    backend_type,
    coalesce(state, 'not_applicable') AS state,
    coalesce(nullif(application_name, ''), 'unset') AS application_name,
    count(*)::text AS connections
  FROM pg_stat_activity
  GROUP BY backend_type, state, application_name
),
lock_rows AS (
  SELECT
    locktype,
    mode,
    granted,
    count(*)::text AS locks
  FROM pg_locks
  GROUP BY locktype, mode, granted
),
cron_jobs AS (
  SELECT
    count(*)::text AS total,
    count(*) FILTER (WHERE active)::text AS active
  FROM cron.job
),
cron_runs AS (
  SELECT
    status,
    count(*)::text AS runs
  FROM cron.job_run_details
  WHERE start_time >= clock_timestamp() - interval '24 hours'
  GROUP BY status
),
installed_extensions AS (
  SELECT
    extname AS name,
    extversion AS version
  FROM pg_extension
),
platform_settings AS (
  SELECT jsonb_build_object(
    'max_connections', current_setting('max_connections'),
    'shared_buffers', current_setting('shared_buffers'),
    'work_mem', current_setting('work_mem'),
    'track_io_timing', current_setting('track_io_timing'),
    'track_wal_io_timing', current_setting('track_wal_io_timing'),
    'pg_stat_statements.max', current_setting('pg_stat_statements.max', true),
    'pg_stat_statements.track', current_setting('pg_stat_statements.track', true),
    'pg_stat_statements.track_planning',
      current_setting('pg_stat_statements.track_planning', true),
    'pg_stat_statements.track_utility',
      current_setting('pg_stat_statements.track_utility', true)
  ) AS value
)
SELECT jsonb_build_object(
  'schema_version', 1,
  'captured_at', (SELECT captured_at FROM capture),
  'server', jsonb_build_object(
    'database_name', (SELECT database_name FROM capture),
    'postmaster_started_at', (SELECT postmaster_started_at FROM capture),
    'server_version', (SELECT server_version FROM capture),
    'server_version_num', (SELECT server_version_num FROM capture),
    'server_build', (SELECT server_build FROM capture)
  ),
  'statistics_boundaries', jsonb_build_object(
    'database_stats_reset', (SELECT stats_reset FROM database_stats),
    'statement_stats_reset', (SELECT stats_reset FROM statement_info),
    'statement_dealloc', (SELECT dealloc FROM statement_info),
    'io_stats_reset', (SELECT stats_reset FROM io_boundary),
    'wal_stats_reset', (SELECT stats_reset FROM wal_stats)
  ),
  'database', (SELECT to_jsonb(database_stats) - 'stats_reset' FROM database_stats),
  'wal', (SELECT to_jsonb(wal_stats) - 'stats_reset' FROM wal_stats),
  'statements', coalesce(
    (SELECT jsonb_agg(to_jsonb(statement_rows)) FROM statement_rows),
    '[]'::jsonb
  ),
  'tables', coalesce(
    (SELECT jsonb_agg(to_jsonb(table_rows)) FROM table_rows),
    '[]'::jsonb
  ),
  'indexes', coalesce(
    (SELECT jsonb_agg(to_jsonb(index_rows)) FROM index_rows),
    '[]'::jsonb
  ),
  'io', coalesce(
    (SELECT jsonb_agg(to_jsonb(io_rows)) FROM io_rows),
    '[]'::jsonb
  ),
  'connections', coalesce(
    (SELECT jsonb_agg(to_jsonb(connection_rows)) FROM connection_rows),
    '[]'::jsonb
  ),
  'locks', coalesce(
    (SELECT jsonb_agg(to_jsonb(lock_rows)) FROM lock_rows),
    '[]'::jsonb
  ),
  'cron', jsonb_build_object(
    'jobs', (SELECT to_jsonb(cron_jobs) FROM cron_jobs),
    'runs_last_24h', coalesce(
      (SELECT jsonb_agg(to_jsonb(cron_runs)) FROM cron_runs),
      '[]'::jsonb
    )
  ),
  'extensions', coalesce(
    (SELECT jsonb_agg(to_jsonb(installed_extensions)) FROM installed_extensions),
    '[]'::jsonb
  ),
  'settings', (SELECT value FROM platform_settings)
) AS snapshot;

ROLLBACK;
