import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations/20260726160000_create_canonical_audit_events.sql'
);

describe('canonical audit events migration contract', () => {
  it('creates an immutable, force-RLS ledger with database-controlled identity', () => {
    const migrationSql = readFileSync(migrationPath, 'utf8');

    expect(migrationSql).toContain('CREATE TABLE public.audit_events');
    expect(migrationSql).toContain('FORCE ROW LEVEL SECURITY');
    expect(migrationSql).toContain(
      'id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid()'
    );
    expect(migrationSql).toContain(
      'occurred_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()'
    );
    expect(migrationSql).toContain(
      'database_transaction_id bigint NOT NULL DEFAULT pg_catalog.txid_current()'
    );
    expect(migrationSql).toContain('merchant_id uuid NOT NULL');
    expect(migrationSql).toContain('actor_user_id uuid');
    expect(migrationSql).not.toMatch(/FOREIGN KEY \(merchant_id\)/);
    expect(migrationSql).not.toMatch(/FOREIGN KEY \(actor_user_id\)/);
    expect(migrationSql).toContain(
      'CREATE TRIGGER reject_audit_event_mutation_v1'
    );
    expect(migrationSql).toContain(
      'BEFORE UPDATE OR DELETE ON public.audit_events'
    );
    expect(migrationSql).toContain(
      'REVOKE ALL ON TABLE public.audit_events FROM PUBLIC, anon, authenticated, service_role'
    );
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION private.write_audit_event_v1'
    );
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION private.reject_audit_event_mutation_v1'
    );
  });

  it('bounds payloads and gives tenant pagination a deterministic order', () => {
    const migrationSql = readFileSync(migrationPath, 'utf8');

    expect(migrationSql).toMatch(/array_length\(changed_fields, 1\).*<= 64/);
    expect(migrationSql).toContain('jsonb_object_length(metadata) <= 16');
    expect(migrationSql).toContain('octet_length(metadata::text) <= 8192');
    expect(migrationSql).toContain('idx_audit_events_merchant_occurred_id');
    expect(migrationSql).toContain('(merchant_id, occurred_at DESC, id DESC)');
    expect(migrationSql).toContain('idx_audit_events_resource_occurred_id');
    expect(migrationSql).not.toContain('to_jsonb(NEW)');
    expect(migrationSql).not.toContain('to_jsonb(OLD)');
  });

  it('exposes only an authenticated, validated merchant-owner reader RPC', () => {
    const migrationSql = readFileSync(migrationPath, 'utf8');

    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.list_merchant_audit_events_v1'
    );
    expect(migrationSql).toContain(
      "RAISE EXCEPTION 'audit_merchant_id_required'"
    );
    expect(migrationSql).toContain("RAISE EXCEPTION 'audit_limit_invalid'");
    expect(migrationSql).toContain("RAISE EXCEPTION 'audit_cursor_invalid'");
    expect(migrationSql).toContain("RAISE EXCEPTION 'audit_filter_invalid'");
    expect(migrationSql).toContain("RAISE EXCEPTION 'not_authenticated'");
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.list_merchant_audit_events_v1'
    );
    expect(migrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.list_merchant_audit_events_v1[\s\S]*TO authenticated/
    );
    expect(migrationSql).toContain(
      'ORDER BY event.occurred_at DESC, event.id DESC'
    );
  });
});
