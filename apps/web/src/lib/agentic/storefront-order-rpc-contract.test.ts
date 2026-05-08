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
const storefrontOrderRpcDefinitionPattern =
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:"public"\s*\.\s*"create_storefront_order"|public\.create_storefront_order)\s*\(/i;

function readLatestStorefrontOrderRpcMigrationSql() {
  let latestSql: string | null = null;
  for (const fileName of readdirSync(migrationsDirectory)
    .filter((file) => migrationFilePattern.test(file))
    .sort()) {
    const sql = readFileSync(resolve(migrationsDirectory, fileName), 'utf8');
    if (storefrontOrderRpcDefinitionPattern.test(sql)) {
      latestSql = sql;
    }
  }

  if (!latestSql) {
    throw new Error('No create_storefront_order migration found');
  }

  return latestSql;
}

describe('agentic storefront order RPC contract', () => {
  it('replaces the latest RPC explicitly instead of patching function text dynamically', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.create_storefront_order('
    );
    expect(sql).not.toContain('pg_get_functiondef');
    expect(sql).not.toContain('EXECUTE v_updated_definition');
  });

  it('keeps latest RPC agentic checkout buyers guest-scoped while preserving standard auth binding', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    const agenticGuardIndex = sql.indexOf(
      'IF public.is_agentic_checkout_context() THEN'
    );
    const nullUserIndex = sql.indexOf('p_user_id := NULL;', agenticGuardIndex);
    const standardAuthIndex = sql.indexOf(
      'ELSIF v_user_id IS NOT NULL THEN',
      nullUserIndex
    );

    expect(agenticGuardIndex).toBeGreaterThan(-1);
    expect(nullUserIndex).toBeGreaterThan(agenticGuardIndex);
    expect(standardAuthIndex).toBeGreaterThan(nullUserIndex);
    expect(sql).toContain('p_user_id := v_user_id;');
    expect(sql).toContain("RAISE EXCEPTION 'user_id_mismatch';");
    expect(sql).toContain("RAISE EXCEPTION 'cannot_set_user_id_anonymously';");
    expect(sql).toMatch(
      /INSERT INTO customers \([\s\S]*user_id[\s\S]*p_user_id/
    );
  });

  it('uses a named customer conflict constraint in the latest RPC to avoid output-column ambiguity', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.create_storefront_order('
    );
    expect(sql).toContain(
      'ON CONFLICT ON CONSTRAINT customers_merchant_id_email_key'
    );
    expect(sql).not.toContain('ON CONFLICT (merchant_id, email)');
  });
});
