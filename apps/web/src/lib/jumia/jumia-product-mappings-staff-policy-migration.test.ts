import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  path.resolve(
    import.meta.dirname,
    '../../../../../supabase/migrations/20260831100000_harden_jumia_product_mappings_staff_writes.sql'
  ),
  'utf8'
);

describe('Jumia product mapping staff-write hardening migration', () => {
  it('replaces the broad policy with a read policy for active staff', () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS jumia_product_mappings_merchant_policy'
    );
    expect(migration).toMatch(
      /CREATE POLICY jumia_product_mappings_select_policy[\s\S]*?FOR SELECT[\s\S]*?staff_members\.status = 'active'/
    );
    expect(migration).not.toMatch(
      /CREATE POLICY jumia_product_mappings_merchant_policy/
    );
  });

  it('requires integrations.manage for staff inserts, updates, and deletes', () => {
    expect(migration).toMatch(
      /CREATE POLICY jumia_product_mappings_insert_policy[\s\S]*?FOR INSERT[\s\S]*?'integrations',[\s\S]*?'manage'/
    );
    expect(migration).toMatch(
      /CREATE POLICY jumia_product_mappings_update_policy[\s\S]*?FOR UPDATE[\s\S]*?'integrations',[\s\S]*?'manage'/
    );
    expect(migration).toMatch(
      /CREATE POLICY jumia_product_mappings_delete_policy[\s\S]*?FOR DELETE[\s\S]*?'integrations',[\s\S]*?'manage'/
    );
  });
});
