import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationFilename =
  '20260801140000_payment_ingress_contract_companion.sql';
const migrationSql = readFileSync(
  resolve(process.cwd(), `../../supabase/migrations/${migrationFilename}`),
  'utf8'
);
const executableSql = migrationSql
  .replace(/--[^\n]*/g, '')
  .replace(/'(?:''|[^'])*'/g, '');
const ddlSql = executableSql.replace(/AS\s+\$\$[\s\S]*?\$\$;/g, '');

const companionRelations = [
  'payment_ingress_signature_key_identities',
  'payment_ingress_deployment_attestations',
  'payment_ingress_deployment_manifest_bindings',
  'payment_ingress_parser_compatibility_proofs',
  'payment_ingress_contract_creation_receipts',
  'payment_ingress_contract_transition_receipts',
] as const;

const companionFunctions = [
  'create_payment_ingress_contract_generation(uuid, uuid)',
  'activate_payment_ingress_contract_generation(uuid, uuid, bigint, uuid)',
  'roll_forward_payment_ingress_contract_generation(uuid, uuid, bigint, uuid, uuid)',
  'rollback_payment_ingress_contract_generation(uuid, uuid, bigint, uuid, uuid)',
  'retire_payment_ingress_contract_generation(uuid, uuid, bigint, uuid)',
] as const;

function functionBody(functionName: string) {
  const match = migrationSql.match(
    new RegExp(
      `CREATE OR REPLACE FUNCTION private\\.${functionName}\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`
    )
  );

  if (!match) {
    throw new Error(`missing payment ingress function body: ${functionName}`);
  }

  return match[1];
}

describe('payment ingress control-plane companion migration', () => {
  it('is the exact timeout-guarded companion migration', () => {
    expect(migrationFilename).toBe(
      '20260801140000_payment_ingress_contract_companion.sql'
    );
    expect(migrationSql).toContain("SET LOCAL lock_timeout = '5s';");
    expect(migrationSql).toContain("SET LOCAL statement_timeout = '30s';");

    for (const relation of companionRelations) {
      expect(migrationSql).toContain(`CREATE TABLE private.${relation}`);
      expect(migrationSql).toContain(
        `ALTER TABLE private.${relation} ENABLE ROW LEVEL SECURITY;`
      );
      expect(migrationSql).toContain(
        `ALTER TABLE private.${relation} FORCE ROW LEVEL SECURITY;`
      );
    }

    expect(executableSql.match(/\bCREATE\s+TABLE\b/gi) ?? []).toHaveLength(6);
    expect(ddlSql).not.toMatch(
      /\b(?:INSERT|UPDATE|DELETE)\s+INTO\s+private\.payment_ingress_(?:signature_key_identities|deployment_attestations|deployment_manifest_bindings|parser_compatibility_proofs|contract_creation_receipts|contract_transition_receipts)\b/i
    );
  });

  it('creates the dedicated no-login executor role and no table grant', () => {
    expect(migrationSql).toContain('CREATE ROLE payment_control_plane');
    for (const roleFlag of [
      'NOLOGIN',
      'NOSUPERUSER',
      'NOCREATEDB',
      'NOCREATEROLE',
      'NOINHERIT',
      'NOREPLICATION',
    ]) {
      expect(migrationSql).toContain(roleFlag);
    }

    for (const relation of companionRelations) {
      for (const role of [
        'PUBLIC',
        'anon',
        'authenticated',
        'service_role',
        'payment_control_plane',
      ]) {
        expect(migrationSql).toContain(
          `REVOKE ALL ON TABLE private.${relation} FROM ${role};`
        );
      }
    }

    expect(executableSql).not.toMatch(
      /\bGRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)\s+ON\s+TABLE\s+private\.payment_ingress_/i
    );
  });

  it('exposes only the five dormant postgres-owned definer writers to the control-plane role', () => {
    for (const signature of companionFunctions) {
      const functionName = signature.slice(0, signature.indexOf('('));
      expect(migrationSql).toContain(
        `CREATE OR REPLACE FUNCTION private.${functionName}`
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `ALTER FUNCTION private\\.${functionName}\\(${signature
            .slice(signature.indexOf('(') + 1, -1)
            .replaceAll(' ', '\\s*')}\\)\\s+OWNER TO postgres;`
        )
      );
      expect(migrationSql).toContain('SECURITY DEFINER');
      expect(migrationSql).toContain("SET search_path = ''");
      expect(migrationSql).toContain(
        `GRANT EXECUTE ON FUNCTION private.${signature} TO payment_control_plane;`
      );
    }

    expect(migrationSql).toContain("current_setting('role', true)");
    expect(migrationSql).toContain("'payment_control_plane'");
    expect(migrationSql).toContain("ERRCODE = '42501'");
    expect(migrationSql).toContain("ERRCODE = 'PT409'");
    expect(migrationSql).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(migrationSql).toContain('pg_catalog.hashtextextended');
    expect(migrationSql).toContain("'created'");
    expect(migrationSql).toContain("'activated'");
    expect(migrationSql).toContain("'rolled_forward'");
    expect(migrationSql).toContain("'rolled_back'");
    expect(migrationSql).toContain("'replayed'");
  });

  it('freezes the non-secret catalog, active-attestation root, and immutable receipts', () => {
    expect(migrationSql).toContain(
      'payment_ingress_deployment_attestations_write_once'
    );
    expect(migrationSql).toContain(
      'payment_ingress_deployment_attestations_write_once_trigger'
    );
    expect(migrationSql).toContain('identity_revision');
    expect(migrationSql).toContain('attestation_id');
    expect(migrationSql).toContain('compatibility_proof_id');
    expect(migrationSql).toContain('request_fingerprint');
    expect(migrationSql).toContain('deployment_binding_id');
    expect(migrationSql).toContain('outgoing_expected_control_version');
    expect(migrationSql).toContain('incoming_expected_control_version');
    expect(migrationSql).toContain('revocation_reference');
    expect(migrationSql).toContain(
      'retention_until > pg_catalog.clock_timestamp()'
    );
    expect(migrationSql).toContain(
      'approved_by uuid NOT NULL REFERENCES auth.users(id)'
    );

    for (const comment of [
      'non-secret',
      'append-only',
      'cas evidence',
      'attestation',
    ]) {
      expect(migrationSql.toLowerCase()).toContain(comment);
    }
  });

  it('serializes each scoped writer before replay and generation row locks', () => {
    for (const functionName of [
      'create_payment_ingress_contract_generation',
      'activate_payment_ingress_contract_generation',
      'roll_forward_payment_ingress_contract_generation',
      'rollback_payment_ingress_contract_generation',
    ]) {
      const body = functionBody(functionName);
      const advisoryLock = body.indexOf('pg_catalog.pg_advisory_xact_lock');
      const receiptReload = body.indexOf('AS receipt');
      const firstRowLock = body.indexOf('FOR UPDATE');

      expect(advisoryLock).toBeGreaterThan(-1);
      expect(receiptReload).toBeGreaterThan(advisoryLock);
      expect(firstRowLock).toBeGreaterThan(receiptReload);
    }

    for (const functionName of [
      'roll_forward_payment_ingress_contract_generation',
      'rollback_payment_ingress_contract_generation',
    ]) {
      const body = functionBody(functionName);
      const outgoingLock = body.indexOf(
        'WHERE generation_row.id = p_outgoing_generation_id\n  FOR UPDATE'
      );
      const incomingSelection = body.indexOf(
        'WHERE generation_row.id = v_proof.candidate_generation_id'
      );
      const incomingLock = body.indexOf('FOR UPDATE', incomingSelection);

      expect(outgoingLock).toBeGreaterThan(-1);
      expect(incomingSelection).toBeGreaterThan(outgoingLock);
      expect(incomingLock).toBeGreaterThan(outgoingLock);
    }
  });

  it('requires proof and deployment approval to share the active root approval', () => {
    for (const functionName of [
      'roll_forward_payment_ingress_contract_generation',
      'rollback_payment_ingress_contract_generation',
    ]) {
      const body = functionBody(functionName);

      expect(body).toContain(
        'v_proof.approval_reference = binding.approval_reference'
      );
      expect(body).toContain(
        'binding.approval_reference = attestation.approval_reference'
      );
    }
  });

  it('does not change runtime/provider routes or create a live control-plane state', () => {
    expect(executableSql).not.toMatch(
      /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|FUNCTION|PROCEDURE|TRIGGER|POLICY|VIEW|INDEX)\s+(?:IF\s+EXISTS\s+)?(?:public|auth|storage)\./i
    );
    expect(executableSql).not.toMatch(
      /\b(?:paystack|korapay|kuda|credit_direct|topship|svix|webhook|checkout)\b/i
    );
    expect(executableSql).not.toMatch(
      /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+public\./i
    );
  });
});
