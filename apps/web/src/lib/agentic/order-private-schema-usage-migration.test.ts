import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(
  currentDirectory,
  '../../../../../supabase/migrations'
);
const migrationFilePattern = /^\d{14}.*\.sql$/;
const statementPattern =
  /(GRANT\s+USAGE\s+ON\s+SCHEMA\s+private\s+TO|REVOKE\s+(?:ALL|USAGE)\s+ON\s+SCHEMA\s+private\s+FROM)\s+([^;]+);/gi;

function applyPrivateSchemaUsageStatements(
  sql: string,
  usage: Map<string, boolean>
) {
  for (const match of sql.matchAll(statementPattern)) {
    const hasUsage = match[1].toUpperCase().startsWith('GRANT');
    const roles = match[2].split(',').map((role) => role.trim());

    for (const role of roles) {
      if (usage.has(role)) {
        usage.set(role, hasUsage);
      }
    }
  }
}

function replayPrivateSchemaUsage() {
  const usage = new Map([
    ['anon', false],
    ['authenticated', false],
    ['service_role', false],
  ]);

  for (const fileName of readdirSync(migrationsDirectory)
    .filter((file) => migrationFilePattern.test(file))
    .sort()) {
    const sql = readFileSync(resolve(migrationsDirectory, fileName), 'utf8');

    applyPrivateSchemaUsageStatements(sql, usage);
  }

  return usage;
}

function readUsageRepairMigration() {
  const fileName = readdirSync(migrationsDirectory).find((file) =>
    file.endsWith('_restore_storefront_order_private_schema_usage.sql')
  );

  if (!fileName) {
    throw new Error(
      'Storefront private-schema usage repair migration is missing'
    );
  }

  return readFileSync(resolve(migrationsDirectory, fileName), 'utf8');
}

describe('bugfix: public checkout wrappers lost private-schema usage', () => {
  it('replays usage-only schema revocations as access removal', () => {
    const usage = new Map([['anon', true]]);

    applyPrivateSchemaUsageStatements(
      'REVOKE USAGE ON SCHEMA private FROM anon;',
      usage
    );

    expect(usage.get('anon')).toBe(false);
  });

  it('leaves storefront roles able to resolve private order implementations after migration replay', () => {
    const usage = replayPrivateSchemaUsage();

    expect(usage.get('anon')).toBe(true);
    expect(usage.get('authenticated')).toBe(true);
    expect(usage.get('service_role')).toBe(true);
  });

  it('keeps direct browser and service-role access to the credential vault revoked', () => {
    const migrationSql = readUsageRepairMigration();

    expect(migrationSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+TABLE\s+private\.merchant_payment_credentials\s+FROM\s+PUBLIC,\s*anon,\s*authenticated,\s*service_role\s*;/i
    );
    expect(migrationSql).not.toMatch(
      /GRANT[^;]*ON\s+TABLE\s+private\.merchant_payment_credentials/i
    );
  });
});
