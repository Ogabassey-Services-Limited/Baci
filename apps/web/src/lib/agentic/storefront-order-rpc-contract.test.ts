import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  currentDirectory,
  '../../../../../supabase/migrations/20260508211500_agentic_storefront_order_guest_user.sql'
);

function readMigrationSql() {
  return readFileSync(migrationPath, 'utf8');
}

describe('agentic storefront order RPC contract', () => {
  it('replaces the RPC explicitly instead of patching function text dynamically', () => {
    const sql = readMigrationSql();

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.create_storefront_order('
    );
    expect(sql).not.toContain('pg_get_functiondef');
    expect(sql).not.toContain('EXECUTE v_updated_definition');
  });

  it('keeps agentic checkout buyers guest-scoped while preserving standard auth binding', () => {
    const sql = readMigrationSql();

    const agenticGuardIndex = sql.indexOf(
      'IF public.is_agentic_checkout_context() THEN'
    );
    const nullUserIndex = sql.indexOf('p_user_id := NULL;', agenticGuardIndex);
    const standardAuthIndex = sql.indexOf(
      'ELSIF v_user_id IS NOT NULL THEN',
      nullUserIndex
    );

    expect(agenticGuardIndex).toBeGreaterThan(-1);
    expect(nullUserIndex).toBeGreaterThan(agenticGuardIndex);
    expect(standardAuthIndex).toBeGreaterThan(nullUserIndex);
    expect(sql).toContain('p_user_id := v_user_id;');
    expect(sql).toContain("RAISE EXCEPTION 'user_id_mismatch';");
    expect(sql).toContain("RAISE EXCEPTION 'cannot_set_user_id_anonymously';");
    expect(sql).toMatch(
      /INSERT INTO customers \([\s\S]*user_id[\s\S]*p_user_id/
    );
  });
});
