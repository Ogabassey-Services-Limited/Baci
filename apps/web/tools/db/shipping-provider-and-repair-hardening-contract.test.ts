import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CARRIER_PROVIDER_IDS } from '@baci/shared/constants';
import { describe, expect, it } from 'vitest';
import { REPLAY_SOURCE_DATA } from './supabase-history-replay-sources';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../../../..');
const HARDENING_MIGRATION_PATH = path.join(
  REPOSITORY_ROOT,
  'supabase/migrations/20260803000100_harden_shipping_provider_policy_and_repair_rate_limits.sql'
);
const CODEX_FOLLOW_UP_MIGRATION_PATH = path.join(
  REPOSITORY_ROOT,
  'supabase/migrations/20260803000200_fix_shipping_provider_and_repair_booking_regressions.sql'
);
const SHIPPING_POLICY_SQL_TEST_PATH = path.join(
  REPOSITORY_ROOT,
  'supabase/tests/shipping_provider_settings.sql'
);
const REPAIR_BOOKING_SQL_TEST_PATH = path.join(
  REPOSITORY_ROOT,
  'supabase/tests/repair_booking_rpc.sql'
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

  it('uses a forward migration to preserve merchant/self fulfillment stamps and valid repair inputs', () => {
    expect(existsSync(CODEX_FOLLOW_UP_MIGRATION_PATH)).toBe(true);
    if (!existsSync(CODEX_FOLLOW_UP_MIGRATION_PATH)) {
      return;
    }

    const migration = readFileSync(CODEX_FOLLOW_UP_MIGRATION_PATH, 'utf8');
    const providerGuard = functionDefinition(
      migration,
      'CREATE OR REPLACE FUNCTION private.enforce_merchant_shipping_provider_enabled()'
    );
    const privateBookingFunction = functionDefinition(
      migration,
      'CREATE OR REPLACE FUNCTION private.create_repair_booking('
    );

    expect(providerGuard).toContain(
      "v_provider IN ('merchant', 'merchant_pickup')"
    );
    expect(providerGuard).toContain("NEW.fulfillment_type = 'self'");
    expect(privateBookingFunction).toContain(
      String.raw`IF v_normalized_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN`
    );
    expect(privateBookingFunction).toContain(
      String.raw`IF v_customer_phone !~ '^\+?[0-9[:space:]-]{10,}$' THEN`
    );

    const shippingPolicySqlTest = readFileSync(
      SHIPPING_POLICY_SQL_TEST_PATH,
      'utf8'
    );
    expect(shippingPolicySqlTest).toContain(
      'merchant and self-fulfillment provider stamps must remain allowed'
    );
    const repairBookingSqlTest = readFileSync(
      REPAIR_BOOKING_SQL_TEST_PATH,
      'utf8'
    );
    expect(repairBookingSqlTest).toContain(
      'ordinary email and phone values must pass the repair booking validator'
    );
    expect(repairBookingSqlTest.match(/IF definition !~ '([^']+)'/)?.[1]).toBe(
      String.raw`pg_advisory_xact_lock\s*\(\s*pg_catalog\.hashtextextended\s*\(\s*p_merchant_id::text\s*,\s*0\s*\)\s*\)`
    );

    const pendingMigrationNames = REPLAY_SOURCE_DATA.PENDING_SOURCES.trim()
      .split('\n')
      .map((row) => row.split(' ')[1]);
    const hardeningMigrationIndex = pendingMigrationNames.indexOf(
      '20260803000100_harden_shipping_provider_policy_and_repair_rate_limits.sql'
    );
    expect(hardeningMigrationIndex).toBeGreaterThanOrEqual(0);
    expect(
      pendingMigrationNames.slice(
        hardeningMigrationIndex,
        hardeningMigrationIndex + 2
      )
    ).toEqual([
      '20260803000100_harden_shipping_provider_policy_and_repair_rate_limits.sql',
      '20260803000200_fix_shipping_provider_and_repair_booking_regressions.sql',
    ]);
  });
});
