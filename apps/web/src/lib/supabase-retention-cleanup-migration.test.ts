import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const initialMigrationSql = readFileSync(
  resolve(
    testDir,
    '../../../../supabase/migrations/20260524162010_supabase_retention_cleanup.sql'
  ),
  'utf8'
);
const hardeningMigrationSql = readFileSync(
  resolve(
    testDir,
    '../../../../supabase/migrations/20260524221240_harden_supabase_retention_cleanup_function.sql'
  ),
  'utf8'
);
const normalizedInitialMigrationSql = initialMigrationSql.replace(/\s+/g, ' ');
const normalizedHardeningMigrationSql = hardeningMigrationSql.replace(
  /\s+/g,
  ' '
);

describe('Supabase retention cleanup migration', () => {
  it('preserves the live-applied initial migration and hardens the RPC in a follow-up migration', () => {
    expect(normalizedInitialMigrationSql).toContain(
      'SECURITY DEFINER SET search_path = public, cron, net'
    );
    expect(normalizedHardeningMigrationSql).toContain(
      "SECURITY DEFINER SET search_path = ''"
    );
    expect(hardeningMigrationSql).toContain('pg_catalog.clock_timestamp()');
    expect(hardeningMigrationSql).toContain(
      'DELETE FROM public.analytics_events'
    );
    expect(hardeningMigrationSql).toContain('DELETE FROM cron.job_run_details');
    expect(hardeningMigrationSql).toContain('DELETE FROM net._http_response');
    expect(normalizedHardeningMigrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.cleanup_database_retention(interval, interval, interval) FROM PUBLIC, anon, authenticated'
    );
    expect(normalizedHardeningMigrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.cleanup_database_retention(interval, interval, interval) TO service_role'
    );
  });
});
