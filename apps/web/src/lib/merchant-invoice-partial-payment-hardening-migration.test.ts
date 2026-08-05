import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = [
  '20260805173000_harden_merchant_invoice_partial_completion.sql',
  '20260805173100_lock_merchant_invoice_exact_completion.sql',
]
  .map((filename) =>
    readFileSync(
      join(process.cwd(), '../../supabase/migrations', filename),
      'utf8'
    )
  )
  .join('\n');

describe('merchant invoice partial payment hardening migration', () => {
  it('wraps both payment writers under the shared advisory lock', () => {
    expect(migration).toContain('complete_merchant_invoice_partial_payment_v1');
    expect(migration).toContain('complete_order_gateway_payment_v1');
    expect(
      migration.match(/'baci_order_payment:' \|\| p_order_id::text/g)
    ).toHaveLength(2);
    expect(migration).toMatch(
      /FROM public\.transactions AS t[\s\S]*FOR UPDATE;/
    );
    expect(migration).toMatch(/FROM public\.orders AS o[\s\S]*FOR UPDATE;/);
  });

  it('includes only active savings redemptions in both locked ledgers', () => {
    expect(
      migration.match(/FROM public\.customer_savings_redemptions AS r/g)
    ).toHaveLength(2);
    expect(
      migration.match(/r\.metadata ->> 'reversed_at' IS NULL/g)
    ).toHaveLength(2);
    expect(migration.match(/\+ v_savings_paid/g)).toHaveLength(2);
  });

  it('refuses a stale exact allocation and files transaction-scoped review', () => {
    const mismatchIndex = migration.indexOf(
      'IF abs(v_txn_amount - v_remaining_before) > 0.01'
    );
    const reviewIndex = migration.indexOf(
      "'merchant_invoice_partial_payment_conflict'",
      mismatchIndex
    );
    const completionIndex = migration.indexOf(
      'complete_order_gateway_payment_v1(',
      mismatchIndex
    );

    expect(mismatchIndex).toBeGreaterThan(-1);
    expect(reviewIndex).toBeGreaterThan(mismatchIndex);
    expect(completionIndex).toBeGreaterThan(reviewIndex);
    expect(migration).toContain(
      "'error_code', 'MERCHANT_INVOICE_PARTIAL_BALANCE_CHANGED'"
    );
    expect(migration).toContain('ON CONFLICT DO NOTHING');
  });

  it('marks only a successful exact completion as idempotently applied', () => {
    expect(migration).toContain("v_completion ->> 'payment_status' = 'paid'");
    expect(migration).toContain("'merchant_invoice_partial_applied', true");
    expect(migration).toContain(
      "'wedge_sweep_resolution', 'merchant_invoice_exact_completed'"
    );
  });

  it('keeps implementation functions private and wrappers service-only', () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.complete_merchant_invoice_partial_payment_v1\([\s\S]*FROM PUBLIC, anon, authenticated, service_role;/
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.complete_order_gateway_payment_v1\([\s\S]*FROM PUBLIC, anon, authenticated, service_role;/
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.complete_merchant_invoice_partial_payment\([\s\S]*TO service_role;/
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.complete_order_gateway_payment\([\s\S]*TO service_role;/
    );
  });
});
