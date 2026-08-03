import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CARRIER_PROVIDER_IDS } from '@baci/shared/constants';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../../../..');
const POLICY_MIGRATION_PATH = path.join(
  REPOSITORY_ROOT,
  'supabase/migrations/20260802220000_centralize_shipping_provider_policy.sql'
);
const POLICY_SQL_TEST_PATH = path.join(
  REPOSITORY_ROOT,
  'supabase/tests/shipping_provider_settings.sql'
);

function parseProviderIds(
  match: RegExpMatchArray | null,
  binding: string
): string[] {
  expect(match, `missing carrier array in ${binding}`).not.toBeNull();

  return [...(match?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
    ([, providerId]) => providerId
  );
}

function supportedCarrierHelperDefinition(migration: string): string {
  const start = migration.search(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+private\.supported_carrier_provider_ids\s*\(\s*\)/i
  );
  expect(
    start,
    'missing private.supported_carrier_provider_ids helper'
  ).toBeGreaterThanOrEqual(0);

  const end = migration.indexOf('$$;', start);
  expect(end, 'missing helper terminator').toBeGreaterThanOrEqual(0);

  return migration.slice(start, end + '$$;'.length);
}

function extractProviderIdsFromHelper(migration: string): string[] {
  return parseProviderIds(
    supportedCarrierHelperDefinition(migration).match(
      /\bAS\s+\$\$\s*SELECT\s+ARRAY\s*\[\s*([^\]]*?)\s*\]\s*::\s*text\s*\[\s*\]\s*;\s*\$\$\s*;/i
    ),
    'private.supported_carrier_provider_ids helper'
  );
}

function extractProviderIdsFromRuntimeAssertion(sqlTest: string): string[] {
  return parseProviderIds(
    sqlTest.match(
      /IF\s+private\.supported_carrier_provider_ids\s*\(\s*\)\s+IS\s+DISTINCT\s+FROM\s+ARRAY\s*\[\s*([^\]]*?)\s*\]\s*::\s*text\s*\[\s*\]\s+THEN/i
    ),
    'private.supported_carrier_provider_ids runtime assertion'
  );
}

describe('shipping provider policy contract', () => {
  it('ignores preceding SQL arrays when reading the named provider policy bindings', () => {
    const migrationWithDecoy = `
      CREATE OR REPLACE FUNCTION private.unrelated_provider_ids()
      RETURNS text[]
      LANGUAGE sql
      AS $$
        SELECT ARRAY['decoy']::text[];
      $$;

      CREATE OR REPLACE FUNCTION private.supported_carrier_provider_ids()
      RETURNS text[]
      LANGUAGE sql
      AS $$
        SELECT ARRAY['gigl', 'topship']::text[];
      $$;
    `;
    const sqlTestWithDecoy = `
      DO $$
      BEGIN
        IF private.unrelated_provider_ids()
          IS DISTINCT FROM ARRAY['decoy']::text[] THEN
          RAISE EXCEPTION 'unrelated assertion';
        END IF;

        IF private.supported_carrier_provider_ids()
          IS DISTINCT FROM ARRAY['gigl', 'topship']::text[] THEN
          RAISE EXCEPTION 'carrier assertion';
        END IF;
      END $$;
    `;

    expect(extractProviderIdsFromHelper(migrationWithDecoy)).toEqual(
      CARRIER_PROVIDER_IDS
    );
    expect(extractProviderIdsFromRuntimeAssertion(sqlTestWithDecoy)).toEqual(
      CARRIER_PROVIDER_IDS
    );
  });

  it('does not scan past the named helper terminator for a later carrier array', () => {
    const migrationWithNonArrayHelper = `
      CREATE OR REPLACE FUNCTION private.supported_carrier_provider_ids()
      RETURNS text[]
      LANGUAGE sql
      AS $$
        SELECT '{}'::text[];
      $$;

      CREATE OR REPLACE FUNCTION private.unrelated_provider_ids()
      RETURNS text[]
      LANGUAGE sql
      AS $$
        SELECT ARRAY['gigl', 'topship']::text[];
      $$;
    `;

    expect(() =>
      extractProviderIdsFromHelper(migrationWithNonArrayHelper)
    ).toThrow(
      'missing carrier array in private.supported_carrier_provider_ids helper'
    );
  });

  it('keeps the database helper, SQL runtime check, and shared carrier catalog aligned', () => {
    const migration = readFileSync(POLICY_MIGRATION_PATH, 'utf8');
    const sqlTest = readFileSync(POLICY_SQL_TEST_PATH, 'utf8');

    expect(extractProviderIdsFromHelper(migration)).toEqual(
      CARRIER_PROVIDER_IDS
    );
    expect(extractProviderIdsFromRuntimeAssertion(sqlTest)).toEqual(
      CARRIER_PROVIDER_IDS
    );
  });
});
