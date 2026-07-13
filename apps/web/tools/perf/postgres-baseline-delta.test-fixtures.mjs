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
    statements: [statement()],
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

export default { END, START, createDelta, raw, sha256, snapshot, statement };
