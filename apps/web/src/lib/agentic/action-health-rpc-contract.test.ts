import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(
  currentDirectory,
  '../../../../../supabase/migrations'
);
const migrationFilePattern = /^\d{14}_.+\.sql$/;
const actionHealthRpcDefinitionPattern =
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_agentic_action_health_records\s*\(/i;

function readActionHealthRpcMigration() {
  const migration = readdirSync(migrationsDirectory)
    .filter((file) => migrationFilePattern.test(file))
    .map((file) => ({
      file,
      sql: readFileSync(resolve(migrationsDirectory, file), 'utf8'),
    }))
    .filter(({ sql }) => actionHealthRpcDefinitionPattern.test(sql))
    .sort((a, b) => a.file.localeCompare(b.file))
    .at(-1);

  if (!migration) {
    throw new Error('No agentic action health RPC migration found');
  }

  return migration.sql;
}

describe('agentic action health RPC migration', () => {
  it('exposes redacted dashboard records without table-level read policies', () => {
    const sql = readActionHealthRpcMigration();

    expect(sql.trim().length).toBeGreaterThan(0);
    expect(sql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_agentic_action_health_records/i
    );
    expect(sql).toMatch(/SECURITY\s+DEFINER/i);
    expect(sql).toMatch(/public\.has_merchant_access\(p_merchant_id\)/i);
    expect(sql).toMatch(
      /public\.check_staff_permission\(\s*auth\.uid\(\),\s*p_merchant_id,\s*'dashboard',\s*'view'\s*\)/i
    );
    expect(sql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_agentic_action_health_records\(uuid,\s*integer\)[\s\S]*?TO\s+authenticated/i
    );
    expect(sql).not.toMatch(
      /CREATE\s+POLICY[\s\S]*?ON\s+public\.agentic_request_records/i
    );
    expect(sql).not.toMatch(
      /CREATE\s+POLICY[\s\S]*?ON\s+public\.agentic_idempotency_records/i
    );
    expect(sql).not.toMatch(
      /\b(request_id|idempotency_key|request_hash|response_body)\b/i
    );
    expect(sql).not.toMatch(/CREATE\s+POLICY[\s\S]*?FOR\s+ALL/i);
    expect(sql).not.toMatch(/CREATE\s+POLICY[\s\S]*?WITH\s+CHECK/i);
  });
});
