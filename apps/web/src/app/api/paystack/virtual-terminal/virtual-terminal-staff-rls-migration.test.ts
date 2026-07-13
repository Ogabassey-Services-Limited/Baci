import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  __dirname,
  '../../../../../../../supabase/migrations/20260713203000_allow_staff_manage_virtual_terminals.sql'
);

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, ' ').trim();
}

describe('virtual terminal constrained sync migration', () => {
  it('uses an authorized atomic RPC without broadening table policies', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const migrationSql = normalizeSql(readFileSync(migrationPath, 'utf8'));

    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.sync_virtual_terminal_local('
    );
    expect(migrationSql).toContain('SECURITY DEFINER SET search_path =');
    expect(migrationSql).toContain(
      "public.check_staff_permission( v_user_id, p_merchant_id, 'integrations', 'manage' )"
    );
    expect(migrationSql).toContain('AND virtual_terminal_code = p_code');
    expect(migrationSql).toContain('ON CONFLICT (code) DO UPDATE');
    expect(migrationSql).toContain(
      'WHERE public.virtual_terminals.merchant_id = p_merchant_id'
    );
    expect(migrationSql).toContain(
      "ELSE NULLIF(btrim(p_account_number), '') IS NOT NULL"
    );
    expect(migrationSql).not.toContain('ALTER POLICY');
  });
});
