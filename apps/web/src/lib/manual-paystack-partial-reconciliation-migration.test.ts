import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260811100000_manual_paystack_partial_reconciliation.sql'
  ),
  'utf8'
);

describe('manual Paystack partial reconciliation migration', () => {
  it('locks and validates the review, order, and provider reference', () => {
    expect(migration).toContain("auth.role()) IS DISTINCT FROM 'service_role'");
    expect(migration).toContain('FROM public.reconciliation_review AS rr');
    expect(migration).toContain('FROM public.orders AS o');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain(
      "v_review_issue_type <> 'payment_match_zero_candidates'"
    );
    expect(migration).toContain('paystack_reference_already_recorded');
  });

  it('creates a separate partial transaction and delegates completion atomically', () => {
    expect(migration).toContain("'manual_reconciliation', true");
    expect(migration).toContain(
      "'order_payment_allocation', 'merchant_invoice_partial'"
    );
    expect(migration).toContain(
      'public.complete_merchant_invoice_partial_payment('
    );
    expect(migration).toContain("'manual_paystack_partial_applied'");
  });

  it('resolves the review and records an operator audit row after success', () => {
    expect(migration).toContain('resolved_at = now()');
    expect(migration).toContain('resolution_notes = format(');
    expect(migration).toContain('INSERT INTO public.audit_logs');
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.reconcile_paystack_unmatched_partial_payment[\s\S]*TO service_role;/
    );
  });
});
