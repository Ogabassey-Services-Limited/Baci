import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260721093207_order_cancellation_side_effect_claims.sql'
  ),
  'utf8'
);

describe('order cancellation side-effect claims migration', () => {
  it('claims and finishes cancellation side effects idempotently', () => {
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.claim_order_cancellation_side_effect('
    );
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.finish_order_cancellation_side_effect('
    );
    expect(migrationSql).toContain("side_effect.status = 'failed'");
    expect(migrationSql).toContain("SET status = 'delivery_uncertain'");
    expect(migrationSql).not.toContain(
      "side_effect.status = 'claimed'\n         AND side_effect.claimed_at <"
    );
    expect(migrationSql).toContain(
      "p_status NOT IN ('completed', 'failed', 'delivery_uncertain')"
    );
    expect(migrationSql).toContain("t.transaction_type = 'refund'");
  });

  it('allows only the trusted service-role retry worker', () => {
    expect(migrationSql).toContain(
      "(SELECT auth.role()) IS DISTINCT FROM 'service_role'"
    );
    expect(migrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.claim_order_cancellation_side_effect[\s\S]*TO service_role/
    );
    expect(migrationSql).not.toMatch(/TO authenticated, service_role/);
    expect(migrationSql).not.toContain('SELECT o.*');
  });
});
