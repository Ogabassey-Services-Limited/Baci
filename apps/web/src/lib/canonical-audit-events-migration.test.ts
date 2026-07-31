import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations/20260730000000_create_canonical_audit_events.sql'
);

describe('canonical audit events migration contract', () => {
  it('uses a unique migration version filename', () => {
    const migrationDirectory = resolve(
      process.cwd(),
      '../../supabase/migrations'
    );
    const matchingMigrationFiles = readdirSync(migrationDirectory).filter(
      (fileName) => fileName.startsWith('20260730000000_')
    );

    expect(new Set(matchingMigrationFiles)).toEqual(
      new Set(['20260730000000_create_canonical_audit_events.sql'])
    );
  });

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
    expect(migrationSql).toContain('database_transaction_id text NOT NULL');
    expect(migrationSql).not.toContain(
      'database_transaction_id text NOT NULL DEFAULT'
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
    expect(migrationSql).toContain('pg_catalog.pg_current_xact_id()::text');
  });

  it('bounds payloads and gives tenant pagination a deterministic order', () => {
    const migrationSql = readFileSync(migrationPath, 'utf8');

    expect(migrationSql).toMatch(
      /COALESCE\(\s*array_length\(p_fields,\s*1\),\s*0\s*\)\s*<=\s*64/
    );
    expect(migrationSql).toContain('octet_length(array_to_string(p_fields');
    expect(migrationSql).toContain('private.audit_event_json_object_valid_v1');
    expect(migrationSql).toContain('idx_audit_events_merchant_occurred_id');
    expect(migrationSql).toContain('(merchant_id, occurred_at DESC, id DESC)');
    expect(migrationSql).toContain('idx_audit_events_resource_occurred_id');
    expect(migrationSql).not.toContain('to_jsonb(NEW)');
    expect(migrationSql).not.toContain('to_jsonb(OLD)');
  });

  it('derives actor attribution and source inside the private writer', () => {
    const migrationSql = readFileSync(migrationPath, 'utf8');

    expect(migrationSql).toContain('v_jwt jsonb := COALESCE(auth.jwt()');
    expect(migrationSql).toContain(
      "v_jwt_role := NULLIF(v_jwt ->> 'role', '')"
    );
    expect(migrationSql).toContain("v_actor_type := 'service'");
    expect(migrationSql).toContain("v_actor_label := 'service_role'");
    expect(migrationSql).toContain("v_source := 'database'");
    expect(migrationSql).not.toContain('p_actor_type text');
    expect(migrationSql).not.toContain('p_actor_label text');
    expect(migrationSql).not.toContain('p_source text');
    expect(migrationSql).not.toContain('private.begin_audit_event_write_v1');
    expect(migrationSql).toContain(
      'CREATE TABLE private.audit_event_writer_capabilities'
    );
    expect(migrationSql).toContain(
      'ALTER TABLE private.audit_event_writer_capabilities ENABLE ROW LEVEL SECURITY'
    );
    expect(migrationSql).toContain('p_writer_capability uuid');
    expect(migrationSql).toContain('audit_writer_capability_required');
    expect(migrationSql).toContain(
      'FROM private.audit_event_writer_capabilities'
    );
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
