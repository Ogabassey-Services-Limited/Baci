import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(
  currentDirectory,
  '../../../../../supabase/migrations'
);
const actionHealthPolicyPattern =
  /^\d{14}_agentic_action_health_dashboard_select\.sql$/;

function readActionHealthPolicyMigration() {
  const migration = readdirSync(migrationsDirectory)
    .filter((file) => actionHealthPolicyPattern.test(file))
    .sort()
    .at(-1);

  if (!migration) {
    throw new Error('No agentic action health policy migration found');
  }

  return readFileSync(resolve(migrationsDirectory, migration), 'utf8');
}

describe('agentic action health policy migration', () => {
  it('allows merchant and staff dashboard reads without granting writes', () => {
    const sql = readActionHealthPolicyMigration();
    const requestPolicyPattern =
      /CREATE\s+POLICY\s+"Merchant and staff can view agentic request records"[\s\S]*?ON\s+public\.agentic_request_records[\s\S]*?FOR\s+SELECT[\s\S]*?USING\s+\(public\.has_merchant_access\(merchant_id\)\)/i;
    const idempotencyPolicyPattern =
      /CREATE\s+POLICY\s+"Merchant and staff can view agentic idempotency records"[\s\S]*?ON\s+public\.agentic_idempotency_records[\s\S]*?FOR\s+SELECT[\s\S]*?USING\s+\(public\.has_merchant_access\(merchant_id\)\)/i;

    expect(sql.trim().length).toBeGreaterThan(0);
    expect(sql).toMatch(requestPolicyPattern);
    expect(sql).toMatch(idempotencyPolicyPattern);
    expect(sql).not.toMatch(/CREATE\s+POLICY[\s\S]*?FOR\s+ALL/i);
    expect(sql).not.toMatch(/CREATE\s+POLICY[\s\S]*?WITH\s+CHECK/i);
  });
});
