import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  resolve(
    currentDirectory,
    '../../../../supabase/migrations/20260516131611_vtu_airtime_loyalty_points.sql'
  ),
  'utf8'
);

describe('VTU loyalty redemption RPC migration contract', () => {
  it('avoids overloading the PostgREST-exposed redeem_loyalty_points RPC', () => {
    const rpcDefinitions =
      migrationSql.match(
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.redeem_loyalty_points\s*\(/gi
      ) ?? [];

    expect(rpcDefinitions).toHaveLength(1);
    expect(migrationSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.redeem_loyalty_points\s*\([\s\S]*p_redemption_id\s+uuid/i
    );
    expect(migrationSql).not.toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.redeem_loyalty_points\s*\(\s*p_customer_id\s+uuid\s*,\s*p_merchant_id\s+uuid\s*,\s*p_points\s+integer\s*,\s*p_wallet_credit\s+numeric\s*\)/i
    );
    expect(migrationSql).not.toContain(
      'ON FUNCTION public.redeem_loyalty_points(uuid, uuid, integer, numeric)'
    );
    expect(migrationSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.redeem_loyalty_points_legacy_rejected\s*\(/i
    );
  });
});
