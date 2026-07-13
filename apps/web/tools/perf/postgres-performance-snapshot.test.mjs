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
    expect(sql).toMatch(/SET LOCAL timezone = 'UTC';/i);
    expect(sql).toMatch(/SET LOCAL DateStyle = 'ISO, MDY';/i);
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
    expect(sql).toMatch(/plans::text AS plans/i);
    expect(sql).toMatch(/statements\.stats_since::text AS stats_since/i);
    expect(sql).toMatch(/temp_bytes::text AS temp_bytes/i);
    expect(sql).toMatch(/wal_bytes::text AS wal_bytes/i);
    expect(sql).toMatch(
      /statements\.shared_blk_read_time::text AS blk_read_time/i
    );
    expect(sql).toMatch(
      /statements\.shared_blk_write_time::text AS blk_write_time/i
    );
    expect(sql).toMatch(
      /statements\.local_blk_read_time::text AS local_blk_read_time/i
    );
    expect(sql).toMatch(
      /statements\.temp_blk_write_time::text AS temp_blk_write_time/i
    );
    expect(sql).not.toMatch(/\bqueryid\b/i);
  });

  it('retains NULL statement text so the delta validator can reject incomplete context', async () => {
    const sql = await readFile(sqlPath, 'utf8');

    expect(sql).toMatch(
      /statements\.query\s+IS NULL\s+OR\s+\(\s*statements\.query NOT ILIKE '%extensions\.pg_stat_statements%'/i
    );
  });

  it('captures every statement collection setting and excludes the capture utility commands', async () => {
    const sql = await readFile(sqlPath, 'utf8');

    expect(sql).toContain("'pg_stat_statements.track_utility'");
    expect(sql).toMatch(/statements\.calls > 0\s+OR statements\.plans > 0/i);
    expect(sql).toMatch(/statements\.query NOT IN \(\s*'BEGIN',\s*'ROLLBACK'/i);
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
    expect(sql).toMatch(/relid::text AS relid/i);
    expect(sql).toMatch(/indexrelid::text AS indexrelid/i);
    expect(sql).not.toMatch(/cron\.job[^\n]*command/i);
  });

  it('normalizes nullable pg_stat_io cells before the strict delta parser reads them', async () => {
    const sql = await readFile(sqlPath, 'utf8');

    for (const field of [
      'reads',
      'writes',
      'writebacks',
      'extends',
      'hits',
      'evictions',
      'reuses',
      'fsyncs',
      'read_time',
      'write_time',
      'writeback_time',
      'extend_time',
      'fsync_time',
    ]) {
      expect(sql).toMatch(
        new RegExp(`coalesce\\(${field}, 0\\)::text AS ${field}`, 'i')
      );
    }
  });

  it('groups connection counts by the normalized exported identity', async () => {
    const sql = await readFile(sqlPath, 'utf8');

    expect(sql).toMatch(
      /GROUP BY\s+backend_type,\s+coalesce\(state, 'not_applicable'\),\s+coalesce\(nullif\(application_name, ''\), 'unset'\)/i
    );
  });
});
