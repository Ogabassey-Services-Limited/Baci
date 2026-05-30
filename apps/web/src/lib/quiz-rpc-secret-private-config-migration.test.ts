import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  resolve(
    currentDirectory,
    '../../../../supabase/migrations/20260527064322_quiz_rpc_secret_private_config.sql'
  ),
  'utf8'
);
const denyPolicySql = readFileSync(
  resolve(
    currentDirectory,
    '../../../../supabase/migrations/20260527065631_quiz_rpc_secret_deny_client_policy.sql'
  ),
  'utf8'
);

describe('quiz RPC private secret config migration', () => {
  it('keeps quiz proof secrets in a private non-exposed table', () => {
    expect(migrationSql).toMatch(
      /CREATE\s+SCHEMA\s+IF\s+NOT\s+EXISTS\s+private/i
    );
    expect(migrationSql).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+private\.quiz_rpc_server_secrets/i
    );
    expect(migrationSql).toMatch(
      /ALTER\s+TABLE\s+private\.quiz_rpc_server_secrets\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
    );
    expect(migrationSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+TABLE\s+private\.quiz_rpc_server_secrets\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i
    );
  });

  it('validates route proofs from the private secret fallback when the GUC is unavailable', () => {
    expect(migrationSql).toMatch(
      /current_setting\('app\.quiz_rpc_server_secret_current',\s*true\)/i
    );
    expect(migrationSql).toMatch(/FROM\s+private\.quiz_rpc_server_secrets/i);
    expect(migrationSql).toMatch(/secret_name\s+=\s+'current'/i);
    expect(migrationSql).toMatch(
      /extensions\.hmac\(v_canonical,\s*v_current_secret/i
    );
  });

  it('makes the production checker accept either configured secret source', () => {
    expect(migrationSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.quiz_rpc_server_secret_configured\(\)/i
    );
    expect(migrationSql).toMatch(
      /NULLIF\(current_setting\('app\.quiz_rpc_server_secret_current',\s*true\),\s*''\)\s+IS\s+NOT\s+NULL/i
    );
    expect(migrationSql).toMatch(
      /EXISTS\s*\([\s\S]*private\.quiz_rpc_server_secrets/i
    );
  });

  it('adds an explicit deny-all client policy for the private secret table', () => {
    expect(denyPolicySql).toMatch(
      /CREATE\s+POLICY\s+quiz_rpc_server_secrets_no_client_access/i
    );
    expect(denyPolicySql).toMatch(/TO\s+anon,\s*authenticated/i);
    expect(denyPolicySql).toMatch(/USING\s+\(false\)/i);
    expect(denyPolicySql).toMatch(/WITH\s+CHECK\s+\(false\)/i);
  });
});
