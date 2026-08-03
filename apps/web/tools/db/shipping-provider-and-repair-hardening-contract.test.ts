import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CARRIER_PROVIDER_IDS } from '@baci/shared/constants';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../../../..');
const HARDENING_MIGRATION_PATH = path.join(
  REPOSITORY_ROOT,
  'supabase/migrations/20260803000100_harden_shipping_provider_policy_and_repair_rate_limits.sql'
);
const SHIPPING_POLICY_SQL_TEST_PATH = path.join(
  REPOSITORY_ROOT,
  'supabase/tests/shipping_provider_settings.sql'
);

function functionDefinition(source: string, signature: string): string {
  const start = source.indexOf(signature);
  expect(start, `missing ${signature}`).toBeGreaterThanOrEqual(0);

  const end = source.indexOf('$$;', start);
  expect(end, `missing terminator for ${signature}`).toBeGreaterThanOrEqual(0);

  return source.slice(start, end + '$$;'.length);
}

describe('shipping provider and repair booking hardening', () => {
  it('uses an inlineable carrier helper, avoids repeated policy checks, and serializes public repair booking limits', () => {
    expect(existsSync(HARDENING_MIGRATION_PATH)).toBe(true);
    if (!existsSync(HARDENING_MIGRATION_PATH)) {
      return;
    }

    const migration = readFileSync(HARDENING_MIGRATION_PATH, 'utf8');
    const carrierHelper = functionDefinition(
      migration,
      'CREATE OR REPLACE FUNCTION private.supported_carrier_provider_ids()'
    );
    const providerGuard = functionDefinition(
      migration,
      'CREATE OR REPLACE FUNCTION private.enforce_merchant_shipping_provider_enabled()'
    );
    const privateBookingFunction = functionDefinition(
      migration,
      'CREATE OR REPLACE FUNCTION private.create_repair_booking('
    );

    expect(carrierHelper).toContain(
      `SELECT ARRAY[${CARRIER_PROVIDER_IDS.map((id) => `'${id}'`).join(', ')}]::text[];`
    );
    expect(carrierHelper).not.toMatch(/\bSET search_path\b/);
    expect(migration).toContain(
      'ALTER FUNCTION private.supported_carrier_provider_ids() RESET search_path;'
    );
    expect(providerGuard).not.toContain(
      'AND lower(btrim(configured_provider.value)) = ANY ('
    );

    const lockOffset = privateBookingFunction.indexOf('pg_advisory_xact_lock');
    const firstRateLimitCountOffset = privateBookingFunction.indexOf(
      'SELECT count(*) INTO v_per_email_count'
    );
    expect(lockOffset).toBeGreaterThanOrEqual(0);
    expect(lockOffset).toBeLessThan(firstRateLimitCountOffset);
  });

  it('covers changed selections after opt-out and mixed-case stored carrier settings', () => {
    const sqlTest = readFileSync(SHIPPING_POLICY_SQL_TEST_PATH, 'utf8');

    expect(sqlTest).toContain(
      'changing a carrier selection after opt-out must be rejected'
    );
    expect(sqlTest).toContain(
      'mixed-case stored carrier settings must authorize a new selection'
    );
  });
});
