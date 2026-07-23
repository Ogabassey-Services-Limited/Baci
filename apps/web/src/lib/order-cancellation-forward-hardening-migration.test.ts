import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cancellationSql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260721140000_forward_harden_merchant_order_cancellation.sql'
  ),
  'utf8'
);
const sideEffectsSql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260721140100_forward_harden_cancellation_side_effects.sql'
  ),
  'utf8'
);

describe('forward cancellation hardening migrations', () => {
  it('replaces the cancellation RPC and restores composed store credit', () => {
    expect(cancellationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.cancel_order_as_merchant('
    );
    expect(cancellationSql).toContain('public.reverse_wallet_redemption(');
    expect(cancellationSql).toContain(
      'public.reverse_savings_redemption_for_order('
    );
    expect(cancellationSql).toContain("'wallet_reversed', v_wallet_reversed");
    expect(cancellationSql).toContain("'savings_reversed', v_savings_reversed");
    expect(cancellationSql).toContain("'out_for_delivery'");
    expect(cancellationSql).toContain('payment_capture_in_flight');
    expect(cancellationSql).not.toContain('SELECT o.*');
  });

  it('locks claim completion to service role and counts real attempts', () => {
    expect(sideEffectsSql).toContain('ALTER COLUMN attempts SET DEFAULT 0');
    expect(sideEffectsSql).toContain(
      'SET attempts = GREATEST(attempts - 1, 0)'
    );
    expect(sideEffectsSql).toContain('side_effect.attempts < 5');
    expect(sideEffectsSql).toContain(
      "refund.metadata->>'payment_transaction_id' = payment.id::text"
    );
    expect(sideEffectsSql).toContain('AND NOT EXISTS (\n    SELECT 1');
    expect(sideEffectsSql).toContain(
      "(SELECT auth.role()) IS DISTINCT FROM 'service_role'"
    );
    expect(sideEffectsSql).not.toMatch(/TO authenticated, service_role/);
  });

  it('creates a durable manual-refund reconciliation category', () => {
    expect(sideEffectsSql).toContain(
      "'order_cancellation_refund_requires_review'"
    );
    expect(sideEffectsSql).toContain(
      'VALIDATE CONSTRAINT reconciliation_review_issue_type_check'
    );
  });
});
