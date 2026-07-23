import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260714093000_scope_capture_review_deduplication.sql'
  ),
  'utf8'
);

describe('capture review deduplication migration', () => {
  it('keeps order navigation while deduplicating capture reviews by transaction or reference', () => {
    expect(migration).toContain(
      'DROP INDEX IF EXISTS public.reconciliation_review_open_by_order_idx'
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX reconciliation_review_open_by_order_idx'
    );
    expect(migration).toContain(
      'ON public.reconciliation_review (issue_type, order_id)'
    );
    expect(migration).toContain('resolved_at IS NULL');
    expect(migration).toContain('order_id IS NOT NULL');
    expect(migration).toContain("'payment_received_after_cancellation'");
    expect(migration).toContain("'payment_received_after_refund'");
    expect(migration).toContain("'merchant_settlement_failed'");
    expect(migration).toContain('issue_type NOT IN');
  });
});
