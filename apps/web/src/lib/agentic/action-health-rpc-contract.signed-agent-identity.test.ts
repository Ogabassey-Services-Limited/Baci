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

function readLatestActionHealthRpcMigration() {
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

describe('agentic action health signed-agent identity RPC contract', () => {
  it('surfaces non-secret signed agent ids without exposing replay secrets', () => {
    const sql = readLatestActionHealthRpcMigration();

    expect(sql).toMatch(/'agent_id',\s*records\.agent_id/i);
    expect(sql).toMatch(/IF\s+p_merchant_id\s+IS\s+NULL\s+THEN/i);
    expect(sql).toMatch(/ERRCODE\s*=\s*'22004'/i);
    expect(sql).toMatch(
      /SELECT\s+agent_id,\s*api_version,\s*route,\s*created_at,\s*expires_at/i
    );
    expect(sql).not.toMatch(
      /\b(request_id|idempotency_key|request_hash|response_body)\b/i
    );
  });
});
