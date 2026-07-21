import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260721093205_harden_paid_order_completion_and_side_effect_retries.sql'
  ),
  'utf8'
);

describe('paid order consistency migration', () => {
  it('writes the complete paid ledger atomically and heals paid replays', () => {
    expect(migrationSql).toContain("SET payment_status = 'paid'");
    expect(migrationSql).toMatch(/amount_paid\s*=\s*total/);
    expect(migrationSql).toMatch(/paid_at\s*=\s*COALESCE\(paid_at,/);
    expect(migrationSql).toContain("ELSIF v_prev_payment_status = 'paid' THEN");
    expect(migrationSql).toContain('v_order_ledger_healed := FOUND');
  });

  it('bounds failed side-effect retries with exponential backoff', () => {
    expect(migrationSql).toContain('payment_side_effects.attempts < 5');
    expect(migrationSql).toContain(
      'power(2, public.payment_side_effects.attempts - 1)'
    );
    expect(migrationSql).toContain("interval '15 minutes'");
  });

  it('keeps both functions service-role only', () => {
    expect(migrationSql).toContain('requires service_role');
    expect(migrationSql).toMatch(/GRANT\s+EXECUTE[\s\S]*TO service_role/);
    expect(migrationSql).toMatch(/FROM PUBLIC, anon, authenticated/);
  });
});
