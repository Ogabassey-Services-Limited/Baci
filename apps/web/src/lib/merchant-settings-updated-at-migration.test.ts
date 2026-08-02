import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationFilename = '20260730103000_enforce_merchant_updated_at_occ.sql';
const triggerMigrationFilename =
  '20260730144747_add_merchants_updated_at_trigger.sql';
const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations',
  migrationFilename
);

describe('merchant settings updated-at OCC migration', () => {
  it('backfills legacy null tokens before making future tokens non-null', () => {
    expect(existsSync(migrationPath)).toBe(true);

    const migrationSql = readFileSync(migrationPath, 'utf8');
    expect(migrationSql).toContain(
      'SET updated_at = COALESCE(updated_at, created_at, pg_catalog.now())'
    );
    expect(migrationSql).toContain(
      'ALTER COLUMN updated_at SET DEFAULT pg_catalog.now()'
    );
    expect(migrationSql).toContain('ALTER COLUMN updated_at SET NOT NULL');
  });

  it('installs a merchant-wide before-update trigger that always advances the token', () => {
    const triggerMigrationPath = resolve(
      process.cwd(),
      '../../supabase/migrations',
      triggerMigrationFilename
    );
    expect(existsSync(triggerMigrationPath)).toBe(true);

    const migrationSql = readFileSync(triggerMigrationPath, 'utf8');
    expect(migrationSql).toContain(
      'DROP TRIGGER IF EXISTS update_merchants_updated_at ON public.merchants'
    );
    expect(migrationSql).toContain('CREATE TRIGGER merchants_set_updated_at');
    expect(migrationSql).toContain('BEFORE UPDATE ON public.merchants');
    expect(migrationSql).toContain('NEW.updated_at := GREATEST(');
    expect(migrationSql).toContain('pg_catalog.clock_timestamp()');
  });
});
