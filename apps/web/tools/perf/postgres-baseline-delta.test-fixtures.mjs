import { createHash } from 'node:crypto';
import { createPostgresBaselineDelta } from './postgres-baseline-delta.mjs';

const START = '2026-07-13T08:00:00.000Z';
const END = '2026-07-14T08:00:00.000Z';
const DEFAULT_ARTIFACTS = {
  afterArtifact: Buffer.from('default-age-encrypted-after'),
  beforeArtifact: Buffer.from('default-age-encrypted-before'),
};

function statement(overrides = {}) {
  return {
    database_name: 'postgres',
    role_name: 'authenticated',
    toplevel: true,
    query: 'select id from public.products where merchant_id = $1',
    queryid: '111',
    stats_since: '2026-07-01T00:00:00.000Z',
    calls: '10',
    total_plan_time: '1.5',
    total_exec_time: '100.5',
    rows: '20',
    shared_blks_hit: '1000',
    shared_blks_read: '10',
    local_blks_hit: '0',
    local_blks_read: '0',
    temp_blks_read: '2',
    temp_blks_written: '3',
    blk_read_time: '0',
    blk_write_time: '0',
    wal_records: '4',
    wal_fpi: '1',
    wal_bytes: '512',
    ...overrides,
  };
}

function table(overrides = {}) {
  return {
    schema_name: 'public',
    table_name: 'products',
    seq_scan: '10',
    seq_tup_read: '20',
    idx_scan: '30',
    idx_tup_fetch: '40',
    n_tup_ins: '50',
    n_tup_upd: '60',
    n_tup_del: '70',
    n_tup_hot_upd: '80',
    n_live_tup: '90',
    n_dead_tup: '10',
    vacuum_count: '2',
    autovacuum_count: '3',
    analyze_count: '4',
    autoanalyze_count: '5',
    table_bytes: '1000',
    indexes_bytes: '2000',
    total_bytes: '3000',
    ...overrides,
  };
}

function index(overrides = {}) {
  return {
    schema_name: 'public',
    table_name: 'products',
    index_name: 'products_pkey',
    idx_scan: '20',
    idx_tup_read: '30',
    idx_tup_fetch: '40',
    index_bytes: '500',
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  const base = {
    schema_version: 1,
    captured_at: START,
    server: {
      database_name: 'postgres',
      postmaster_started_at: '2026-07-01T00:00:00.000Z',
      server_build: 'PostgreSQL 17.6 Supabase build 17.6.1.032',
      server_version: '17.6',
      server_version_num: '170006',
    },
    statistics_boundaries: {
      database_stats_reset: null,
      io_stats_reset: '2026-07-01T00:00:00.000Z',
      statement_dealloc: '7',
      statement_stats_reset: '2026-07-01T00:00:00.000Z',
      wal_stats_reset: '2026-07-01T00:00:00.000Z',
    },
    database: {
      xact_commit: '100',
      xact_rollback: '2',
      blks_read: '10',
      blks_hit: '1000',
      tup_returned: '5000',
      tup_fetched: '4000',
      tup_inserted: '10',
      tup_updated: '20',
      tup_deleted: '3',
      conflicts: '0',
      temp_files: '4',
      temp_bytes: '9007199254740993',
      deadlocks: '0',
      blk_read_time: '0',
      blk_write_time: '0',
      sessions: '50',
      sessions_abandoned: '0',
      sessions_fatal: '0',
      sessions_killed: '0',
    },
    wal: {
      wal_records: '100',
      wal_fpi: '10',
      wal_bytes: '4096',
      wal_buffers_full: '0',
    },
    settings: {
      max_connections: '60',
      shared_buffers: '256MB',
      work_mem: '4MB',
      track_io_timing: 'on',
      track_wal_io_timing: 'off',
      'pg_stat_statements.max': '5000',
      'pg_stat_statements.track': 'all',
      'pg_stat_statements.track_planning': 'on',
    },
    statements: [statement()],
    tables: [table()],
    indexes: [index()],
    client_telemetry: {
      p95: 999,
      secret: 'must-not-persist',
    },
  };

  return {
    ...base,
    ...overrides,
    server: { ...base.server, ...overrides.server },
    statistics_boundaries: {
      ...base.statistics_boundaries,
      ...overrides.statistics_boundaries,
    },
    database: { ...base.database, ...overrides.database },
    wal: { ...base.wal, ...overrides.wal },
    settings: { ...base.settings, ...overrides.settings },
  };
}

function raw(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function createDelta(options) {
  return createPostgresBaselineDelta({ ...DEFAULT_ARTIFACTS, ...options });
}

export default {
  END,
  START,
  createDelta,
  index,
  raw,
  sha256,
  snapshot,
  statement,
  table,
};
