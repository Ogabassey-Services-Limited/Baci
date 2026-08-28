import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260828020000_authenticate_transaction_discount_metadata.sql'
  ),
  'utf8'
);

describe('transaction discount provenance migration', () => {
  it('accepts only proof-bound storefront metadata and strips forged markers', () => {
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION private\.sanitize_storefront_transaction_discount_metadata\(\)/i
    );
    expect(migrationSql).toMatch(
      /v_proof -> 'payload' = \(v_metadata - 'proof'\)/i
    );
    expect(migrationSql).toMatch(
      /quiz_route_proof_valid\([\s\S]*?'storefront_transaction_discount'/i
    );
    expect(migrationSql).toContain("v_tracking - 'baci_transaction_discount'");
    expect(migrationSql).toMatch(
      /CREATE TRIGGER sanitize_storefront_transaction_discount_metadata[\s\S]*?ON public\.orders/i
    );
  });

  it('scopes admin provenance to the authenticated edit wrapper context', () => {
    expect(migrationSql).toMatch(
      /current_setting\('app\.transaction_discount_admin_edit', true\) = '1'/i
    );
    expect(migrationSql).toMatch(
      /set_config\([\s\S]*?'app\.transaction_discount_admin_edit'[\s\S]*?'1'/i
    );
    expect(migrationSql).toContain(
      "jsonb_build_object('status', 'admin_edit', 'version', 4)"
    );
  });
});
