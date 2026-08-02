import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  __dirname,
  '../../../../../../../supabase/migrations/20260714121500_lock_down_virtual_terminal_sync.sql'
);
const unsafeAuthenticatedWrapperMigrationPath = resolve(
  __dirname,
  '../../../../../../../supabase/migrations/20260731180000_authorize_scoped_virtual_terminal_mutations.sql'
);

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, ' ').trim();
}

describe('virtual terminal constrained sync migration', () => {
  it('does not expose authenticated provider-sync wrappers without unforgeable provider proof', () => {
    expect(existsSync(unsafeAuthenticatedWrapperMigrationPath)).toBe(false);
  });

  it('keeps ownership and provider sync off authenticated clients', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const migrationSql = normalizeSql(readFileSync(migrationPath, 'utf8'));

    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.sync_virtual_terminal_local('
    );
    expect(migrationSql).toContain('SECURITY INVOKER SET search_path =');
    expect(migrationSql).toContain(
      'DROP POLICY IF EXISTS "Merchants can create terminals"'
    );
    expect(migrationSql).toContain(
      'DROP POLICY IF EXISTS "Merchants can update own terminals"'
    );
    expect(migrationSql).toContain(
      'DROP POLICY IF EXISTS "Merchants can delete own terminals"'
    );
    expect(migrationSql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON public.virtual_terminals FROM anon, authenticated'
    );
    expect(migrationSql).toContain(') FROM PUBLIC, anon, authenticated');
    expect(migrationSql).toContain(') TO service_role');
    expect(migrationSql).toContain(
      "merchants.virtual_terminal_code ~ '^VT_[A-Za-z0-9]+$'"
    );
    expect(migrationSql).toContain(
      "account_number = COALESCE( NULLIF(btrim(p_account_number), ''), account_number )"
    );
    expect(migrationSql).toContain('active = COALESCE(p_active, active)');
    expect(migrationSql).toContain('AND p_account_number IS NULL');
    expect(migrationSql).toContain('AND p_account_name IS NULL');
    expect(migrationSql).toContain('AND p_bank IS NULL');
    expect(migrationSql).toContain(
      "RAISE EXCEPTION 'Trusted virtual terminal mapping not found'"
    );
    expect(migrationSql).not.toContain('check_staff_permission');
  });
});
