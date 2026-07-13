import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd().endsWith('/apps/web')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const sqlPath = resolve(
  repoRoot,
  'supabase/diagnostics/postgres-performance-snapshot.sql'
);

describe('postgres performance snapshot', () => {
  it('is read-only and captures every reset boundary used by the delta guard', async () => {
    const sql = await readFile(sqlPath, 'utf8');

    expect(sql).toMatch(/BEGIN;[\s\S]*SET TRANSACTION READ ONLY;/i);
    expect(sql).toContain('pg_postmaster_start_time()');
    expect(sql).toContain('database_stats_reset');
    expect(sql).toContain('statement_stats_reset');
    expect(sql).toContain('statement_dealloc');
    expect(sql).toContain('io_stats_reset');
    expect(sql).toContain('wal_stats_reset');
    expect(sql).not.toMatch(/pg_stat_reset\s*\(/i);
    expect(sql).not.toMatch(/pg_stat_statements_reset\s*\(/i);
  });

  it('captures cumulative counters as text and keeps queryid out of the contract', async () => {
    const sql = await readFile(sqlPath, 'utf8');

    expect(sql).toContain('extensions.pg_stat_statements');
    expect(sql).toContain('extensions.pg_stat_statements_info');
    expect(sql).toMatch(/calls::text AS calls/i);
    expect(sql).toMatch(/statements\.stats_since::text AS stats_since/i);
    expect(sql).toMatch(/temp_bytes::text AS temp_bytes/i);
    expect(sql).toMatch(/wal_bytes::text AS wal_bytes/i);
    expect(sql).toMatch(
      /statements\.shared_blk_read_time::text AS blk_read_time/i
    );
    expect(sql).toMatch(
      /statements\.shared_blk_write_time::text AS blk_write_time/i
    );
    expect(sql).not.toMatch(/\bqueryid\b/i);
  });

  it('captures the P0 database surfaces without persisting advisor commands', async () => {
    const sql = await readFile(sqlPath, 'utf8');

    for (const surface of [
      'pg_stat_database',
      'pg_stat_user_tables',
      'pg_stat_user_indexes',
      'pg_stat_io',
      'pg_stat_activity',
      'pg_locks',
      'cron.job',
      'cron.job_run_details',
    ]) {
      expect(sql).toContain(surface);
    }
    expect(sql).not.toMatch(/cron\.job[^\n]*command/i);
  });
});
