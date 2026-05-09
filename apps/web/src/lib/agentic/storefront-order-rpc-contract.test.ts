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
const storefrontOrderRpcNamePattern = String.raw`(?:(?:"public"|public)\s*\.\s*(?:"create_storefront_order"|create_storefront_order)|(?:"create_storefront_order"|create_storefront_order))`;
const storefrontOrderRpcDefinitionPattern = new RegExp(
  String.raw`CREATE\s+OR\s+REPLACE\s+FUNCTION\s+${storefrontOrderRpcNamePattern}\s*\(`,
  'i'
);
const storefrontOrderRpcDynamicPatchPatterns = [
  /pg_get_functiondef\s*\([^;]*create_storefront_order/i,
  new RegExp(
    String.raw`EXECUTE\s+(?:format\s*\([^;]*create_storefront_order|['"][^;]*create_storefront_order|[^;]*CREATE\s+OR\s+REPLACE\s+FUNCTION\s+${storefrontOrderRpcNamePattern})`,
    'i'
  ),
];
const ambiguousCustomerConflictTargetPattern =
  /ON\s+CONFLICT\s*\(\s*merchant_id\s*,\s*email\s*\)/i;

function readLatestStorefrontOrderRpcMigrationSql() {
  for (const fileName of readdirSync(migrationsDirectory)
    .filter((file) => migrationFilePattern.test(file))
    .sort()
    .reverse()) {
    const sql = readFileSync(resolve(migrationsDirectory, fileName), 'utf8');
    if (
      storefrontOrderRpcDefinitionPattern.test(sql) ||
      storefrontOrderRpcDynamicPatchPatterns.some((pattern) =>
        pattern.test(sql)
      )
    ) {
      return sql;
    }
  }

  throw new Error('No create_storefront_order migration found');
}

describe('agentic storefront order RPC contract', () => {
  it('replaces the latest RPC explicitly instead of patching function text dynamically', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    expect(sql).toMatch(storefrontOrderRpcDefinitionPattern);
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

    expect(sql).toMatch(storefrontOrderRpcDefinitionPattern);
    expect(sql).toContain(
      'ON CONFLICT ON CONSTRAINT customers_merchant_id_email_key'
    );
    expect(sql).not.toMatch(ambiguousCustomerConflictTargetPattern);
  });

  it('resolves authenticated customers by user before unbound guest phone fallback', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    const userLookupIndex = sql.indexOf('AND c.user_id = p_user_id');
    const phoneLookupIndex = sql.indexOf(
      'AND c.phone = v_normalized_customer_phone'
    );
    const customerInsertIndex = sql.indexOf('INSERT INTO customers');

    expect(userLookupIndex).toBeGreaterThan(-1);
    expect(phoneLookupIndex).toBeGreaterThan(-1);
    expect(customerInsertIndex).toBeGreaterThan(-1);
    expect(userLookupIndex).toBeLessThan(phoneLookupIndex);
    expect(phoneLookupIndex).toBeLessThan(customerInsertIndex);
    expect(sql).toContain(
      'IF p_user_id IS NULL AND v_normalized_customer_phone IS NOT NULL THEN'
    );
    expect(sql).toContain('AND c.user_id IS NULL');
    expect(sql).toContain(
      "v_normalized_customer_phone TEXT := NULLIF(trim(COALESCE(p_customer_phone, '')), '')"
    );
    expect(sql).toContain('v_customer_record_phone,');
    expect(sql).toContain(
      'WHEN customers.phone = EXCLUDED.phone THEN customers.phone'
    );
  });

  it('does not write a conflicting phone to a new customer record', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    expect(sql).toContain('v_customer_record_phone TEXT;');
    expect(sql).toContain(
      'v_customer_record_phone := v_normalized_customer_phone;'
    );
    expect(sql).toContain('IF v_normalized_customer_phone IS NOT NULL');
    expect(sql).toContain('v_customer_record_phone := NULL;');
    expect(sql).toContain('WHERE existing_phone.merchant_id = p_merchant_id');
    expect(sql).toContain(
      'AND existing_phone.phone = v_normalized_customer_phone'
    );
  });

  it('serializes same-phone customer resolution and applies stock updates in a deterministic order', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    expect(sql).toContain('PERFORM pg_advisory_xact_lock(');
    expect(sql).toContain('hashtext(p_merchant_id::text)');
    expect(sql).toContain('hashtext(v_normalized_customer_phone)');
    expect(sql).toContain('ORDER BY t.product_id, t.variant_id');
  });
});
