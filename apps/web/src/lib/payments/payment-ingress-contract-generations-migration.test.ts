import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260731140000_payment_ingress_contract_generation_foundation.sql'
  ),
  'utf8'
);
const executableSql = migrationSql
  .replace(/--[^\n]*/g, '')
  .replace(/'(?:''|[^'])*'/g, '');

describe('payment ingress contract generations migration', () => {
  it('creates only the private dormant ingress-generation registry', () => {
    expect(migrationSql).toContain("SET LOCAL lock_timeout = '5s';");
    expect(migrationSql).toContain("SET LOCAL statement_timeout = '30s';");
    expect(migrationSql).toContain(
      'CREATE TABLE private.payment_ingress_contract_generations'
    );
    expect(migrationSql).toContain(
      "COMMENT ON TABLE private.payment_ingress_contract_generations IS 'Pre-tenant, endpoint-scoped, non-financial ingress contract registry; contains no secrets and grants no completion authority.'"
    );
    expect(migrationSql).toContain(
      'ALTER TABLE private.payment_ingress_contract_generations ENABLE ROW LEVEL SECURITY;'
    );
    expect(migrationSql).toContain(
      'ALTER TABLE private.payment_ingress_contract_generations FORCE ROW LEVEL SECURITY;'
    );
    expect(executableSql.match(/\bCREATE\s+TABLE\b/gi) ?? []).toHaveLength(1);
    expect(executableSql).toMatch(
      /\bCREATE\s+TABLE\s+private\.payment_ingress_contract_generations\b/i
    );
    expect(executableSql).not.toMatch(
      /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE|TRIGGER|POLICY|ROLE)\b|\bINSERT\s+INTO\b|\bGRANT\s+|\bDROP\b/i
    );
    expect(executableSql).not.toMatch(
      /\bALTER\s+(?:TABLE|INDEX|FUNCTION|PROCEDURE|TRIGGER|POLICY|TYPE|VIEW|MATERIALIZED\s+VIEW)\s+(?:IF\s+EXISTS\s+)?(?:public|auth|storage)\./i
    );
  });

  it('denies every direct access path while preserving the required contract comments', () => {
    for (const role of ['PUBLIC', 'anon', 'authenticated', 'service_role']) {
      expect(migrationSql).toContain(
        `REVOKE ALL ON TABLE private.payment_ingress_contract_generations FROM ${role};`
      );
    }

    expect(migrationSql).toContain(
      "COMMENT ON TABLE private.payment_ingress_contract_generations IS 'Pre-tenant, endpoint-scoped, non-financial ingress contract registry; contains no secrets and grants no completion authority.'"
    );
    expect(migrationSql).toContain(
      "COMMENT ON COLUMN private.payment_ingress_contract_generations.signature_key_identity_id IS 'Opaque non-secret identity; deliberately unbound until the reviewed identity catalog and guarded creator land.'"
    );
    expect(migrationSql).toContain(
      "COMMENT ON COLUMN private.payment_ingress_contract_generations.authority_key IS 'Classifier only, never a completion-authority grant.'"
    );
    expect(migrationSql).toContain(
      "COMMENT ON COLUMN private.payment_ingress_contract_generations.successor_generation_id IS 'Forward-only, same-scope successor; no writer exists in this slice.'"
    );
  });

  it('freezes the scoped successor and lifecycle constraints', () => {
    expect(migrationSql).toContain(
      'CONSTRAINT payment_ingress_contract_generations_successor_fkey'
    );
    expect(migrationSql).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(migrationSql).toContain(
      'payment_ingress_contract_generations_one_active_uidx'
    );
    expect(migrationSql).toContain(
      'payment_ingress_contract_generations_scope_status_idx'
    );
  });
});
