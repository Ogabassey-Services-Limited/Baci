import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  resolve(
    testDir,
    '../../../../supabase/migrations/20260524162010_supabase_retention_cleanup.sql'
  ),
  'utf8'
);
const normalizedMigrationSql = migrationSql.replace(/\s+/g, ' ');

describe('Supabase retention cleanup migration', () => {
  it('restricts the maintenance RPC and avoids mutable search paths', () => {
    expect(normalizedMigrationSql).toContain(
      "SECURITY DEFINER SET search_path = ''"
    );
    expect(migrationSql).toContain('pg_catalog.clock_timestamp()');
    expect(migrationSql).toContain('DELETE FROM public.analytics_events');
    expect(migrationSql).toContain('DELETE FROM cron.job_run_details');
    expect(migrationSql).toContain('DELETE FROM net._http_response');
    expect(normalizedMigrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.cleanup_database_retention(interval, interval, interval) FROM PUBLIC, anon, authenticated'
    );
    expect(normalizedMigrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.cleanup_database_retention(interval, interval, interval) TO service_role'
    );
  });
});
