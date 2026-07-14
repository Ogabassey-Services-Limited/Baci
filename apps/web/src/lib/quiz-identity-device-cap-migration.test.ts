import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  resolve(
    currentDirectory,
    '../../../../supabase/migrations/20260714102200_quiz_identity_and_device_caps.sql'
  ),
  'utf8'
);

describe('quiz identity and device cap migration', () => {
  it('canonicalizes googlemail aliases to gmail identities', () => {
    expect(migrationSql).toMatch(
      /IF v_domain = 'googlemail\.com' THEN\s+v_domain := 'gmail\.com'/i
    );
    expect(migrationSql).toMatch(
      /IF v_domain = 'gmail\.com' THEN\s+v_local := pg_catalog\.split_part\(v_local, '\+', 1\)/i
    );
  });

  it('does not collapse plus signs for unconfigured email providers', () => {
    expect(migrationSql).not.toMatch(
      /v_local := pg_catalog\.split_part\(v_local, '\+', 1\);\s+-- Google treats/i
    );
  });

  it('serializes identity-cap checks before counting attempts', () => {
    const identityFunction = migrationSql.match(
      /CREATE OR REPLACE FUNCTION public\.quiz_enforce_identity_attempt_cap[\s\S]*?\$\$;/i
    )?.[0];

    expect(identityFunction).toBeDefined();
    expect(identityFunction).toMatch(/pg_advisory_xact_lock/i);
    expect(identityFunction?.indexOf('pg_advisory_xact_lock')).toBeLessThan(
      identityFunction?.indexOf('SELECT pg_catalog.count(*)') ?? -1
    );
  });

  it('persists device-cap disqualification and returns a rejected result', () => {
    const bindFunction = migrationSql.match(
      /CREATE FUNCTION public\.bind_quiz_attempt_device[\s\S]*?\$\$;/i
    )?.[0];

    expect(bindFunction).toBeDefined();
    expect(bindFunction).toMatch(/RETURNS boolean/i);
    expect(bindFunction).toMatch(/v_user_id := auth\.uid\(\)/i);
    expect(bindFunction).not.toMatch(/p_user_id uuid/i);
    expect(bindFunction).toMatch(
      /quiz_route_proof_valid[\s\S]*?'bind_quiz_attempt_device_v1'/i
    );
    expect(bindFunction).toMatch(
      /SELECT d\.device_hash[\s\S]*?v_bound_device_hash[\s\S]*?IS DISTINCT FROM p_device_hash/i
    );
    expect(bindFunction).toMatch(
      /UPDATE public\.quiz_attempts[\s\S]*?status = 'disqualified'[\s\S]*?RETURN false;/i
    );
    expect(bindFunction).not.toMatch(
      /RAISE EXCEPTION 'quiz_device_attempt_limit'/i
    );
    expect(bindFunction).toMatch(/RETURN true;/i);
    expect(migrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.bind_quiz_attempt_device\(uuid, text, jsonb\) TO authenticated;/i
    );
    expect(migrationSql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.bind_quiz_attempt_device[^;]*service_role/i
    );
  });
});
