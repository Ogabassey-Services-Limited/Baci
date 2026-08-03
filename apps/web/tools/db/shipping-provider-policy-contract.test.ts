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

function parseSqlArray(source: string, context: string): string[] {
  const match = source.match(
    new RegExp(`${context}\\s*ARRAY\\[([^\\]]*)\\]::text\\[\\]`, 's')
  );
  expect(match, `missing carrier array after ${context}`).not.toBeNull();

  return [...(match?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
    ([, providerId]) => providerId
  );
}

describe('shipping provider policy contract', () => {
  it('keeps the database helper, SQL runtime check, and shared carrier catalog aligned', () => {
    const migration = readFileSync(POLICY_MIGRATION_PATH, 'utf8');
    const sqlTest = readFileSync(POLICY_SQL_TEST_PATH, 'utf8');

    expect(sqlTest).toContain('private.supported_carrier_provider_ids()');
    expect(parseSqlArray(migration, 'SELECT')).toEqual(CARRIER_PROVIDER_IDS);
    expect(parseSqlArray(sqlTest, 'IS DISTINCT FROM')).toEqual(
      CARRIER_PROVIDER_IDS
    );
  });
});
