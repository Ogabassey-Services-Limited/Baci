import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(
  currentDirectory,
  '../../../../supabase/migrations'
);

function readMigration(file: string): string {
  return readFileSync(resolve(migrationsDirectory, file), 'utf8');
}

const CREDENTIAL_COLUMNS = [
  'nin',
  'bvn',
  'bank_account_number',
  'bank_account_name',
  'bank_code',
  'paystack_subaccount_code',
  'virtual_terminal_code',
  'stripe_customer_id',
  'facebook_capi_token',
  'facebook_capi_access_token',
  'ga4_api_secret',
  'tiktok_access_token',
  'snapchat_capi_token',
] as const;

describe('get_staff_permissions per-resource deep merge migration', () => {
  const sql = readMigration(
    '20260724000001_deep_merge_get_staff_permissions.sql'
  );

  it('redefines get_staff_permissions as SECURITY DEFINER with an empty search_path', () => {
    expect(sql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_staff_permissions/i
    );
    expect(sql).toMatch(/SECURITY\s+DEFINER/i);
    expect(sql).toMatch(/SET\s+search_path\s*=\s*''/i);
  });

  it('deep-merges each custom resource over the defaults instead of a shallow replace', () => {
    // Per-resource overlay: iterate custom keys and concat onto the default
    // resource object so sibling default actions survive.
    expect(sql).toMatch(/pg_catalog\.jsonb_each\(v_custom_permissions\)/);
    expect(sql).toMatch(
      /COALESCE\(\s*v_effective_permissions\s*->\s*v_resource,\s*'\{\}'::jsonb\s*\)\s*\|\|\s*v_actions/
    );
    // It must NOT fall back to the old shallow top-level merge of the two maps.
    expect(sql).not.toMatch(
      /COALESCE\(v_default_permissions[\s\S]*?\|\|\s*COALESCE\(v_custom_permissions/
    );
  });

  it('preserves the caller / service-role / merchant-access guard', () => {
    expect(sql).toMatch(
      /auth\.role\(\)[\s\S]*?<>[\s\S]*?'service_role'[\s\S]*?auth\.uid\(\)[\s\S]*?IS\s+DISTINCT\s+FROM\s+v_staff_user_id[\s\S]*?has_merchant_access/i
    );
    expect(sql).toMatch(/RAISE\s+EXCEPTION[\s\S]*?42501/i);
  });

  it('revokes execute from anon (default privileges grant it on creation)', () => {
    expect(sql).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_staff_permissions\(uuid\)\s+FROM\s+PUBLIC,\s*anon/i
    );
  });
});

describe('merchant credential write-guard trigger migration', () => {
  const sql = readMigration(
    '20260724000002_reject_staff_merchant_credential_writes.sql'
  );

  it('installs a BEFORE UPDATE row trigger on merchants', () => {
    expect(sql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.reject_staff_merchant_credential_writes/i
    );
    expect(sql).toMatch(
      /BEFORE\s+UPDATE\s+ON\s+public\.merchants[\s\S]*?FOR\s+EACH\s+ROW[\s\S]*?EXECUTE\s+FUNCTION\s+public\.reject_staff_merchant_credential_writes/i
    );
  });

  it('lets migration (null role), service-role, and owner writes bypass the guard', () => {
    expect(sql).toMatch(/v_role\s+IS\s+NULL/i);
    expect(sql).toMatch(/v_role\s*=\s*'service_role'/i);
    expect(sql).toMatch(/v_uid\s*=\s*OLD\.user_id/i);
  });

  it('rejects an actual change to every guarded credential column', () => {
    for (const column of CREDENTIAL_COLUMNS) {
      expect(sql).toMatch(
        new RegExp(
          `NEW\\.${column}\\s+IS\\s+DISTINCT\\s+FROM\\s+OLD\\.${column}`,
          'i'
        )
      );
    }
    expect(sql).toMatch(/RAISE\s+EXCEPTION[\s\S]*?42501/i);
  });

  it('does not guard a stripe_account_id column that does not exist on merchants', () => {
    // The column is referenced only in the explanatory comment; there must be
    // no IS DISTINCT FROM guard clause for it.
    expect(sql).not.toMatch(
      /NEW\.stripe_account_id\s+IS\s+DISTINCT\s+FROM\s+OLD\.stripe_account_id/i
    );
  });
});
