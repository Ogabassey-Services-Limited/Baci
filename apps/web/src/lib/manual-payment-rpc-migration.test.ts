import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260710213000_harden_manual_payment_idempotency.sql'
  ),
  'utf8'
);

describe('manual payment RPC migration', () => {
  it('requires an idempotency key and stores it in transaction metadata', () => {
    expect(migration).toContain('p_idempotency_key text');
    expect(migration).toContain(
      "'manual_payment_idempotency_key', v_idempotency_key"
    );
    expect(migration).toContain("'idempotency_replayed', true");
  });

  it('rejects non-object metadata before the indexed key is merged', () => {
    expect(migration).toContain(
      "p_metadata IS NULL OR jsonb_typeof(p_metadata) <> 'object'"
    );
    expect(migration).toContain("'error_code', 'INVALID_METADATA'");
    expect(migration).toContain('p_metadata || jsonb_build_object(');
  });

  it('uses amount_paid as a non-duplicating baseline and updates it atomically', () => {
    expect(migration).toContain(
      'COALESCE(o.amount_paid, 0)::numeric AS amount_paid'
    );
    expect(migration).toContain('v_total_paid_before := greatest(');
    expect(migration).toContain('amount_paid = v_new_paid');
    expect(
      migration.match(/'previous_amount_paid', v_previous_amount_paid/g)?.length
    ).toBe(2);
  });

  it('keeps the transaction insert and order update inside the locked RPC', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('INSERT INTO public.transactions');
    expect(migration).toContain('UPDATE public.orders AS o');
  });

  it('reconciles idempotent replays from completed payment ledger rows', () => {
    const ledgerReadIndex = migration.indexOf(
      "AND t.transaction_type = 'payment'\n    AND t.status = 'completed';"
    );
    const replayIndex = migration.indexOf('IF FOUND THEN');
    const replayEndIndex = migration.indexOf('\n  IF EXISTS (', replayIndex);
    const replayBlock = migration.slice(replayIndex, replayEndIndex);

    expect(ledgerReadIndex).toBeGreaterThan(-1);
    expect(ledgerReadIndex).toBeLessThan(replayIndex);
    expect(replayBlock).toContain('v_ledger_paid');
    expect(replayBlock).toContain('amount_paid = v_new_paid');
    expect(replayBlock).toContain("WHEN o.payment_status = 'refunded'");
  });

  it('matches retries only by the caller-provided idempotency key', () => {
    expect(migration).toContain(
      "NULLIF(trim(t.metadata ->> 'manual_payment_idempotency_key'), '') ="
    );
    expect(migration).not.toContain('legacy_manual_payment_fingerprint');
  });

  it('persists resumable manual-payment side-effect claims', () => {
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS public.manual_payment_side_effects'
    );
    expect(migration).toContain('PRIMARY KEY (dedupe_id, step)');
    expect(migration).toContain('v_dedupe_id := p_transaction_id');
    expect(migration).toContain("p_step <> 'partial_receipt'");
    expect(migration).not.toContain("'paid_email', 'partial_receipt'");
    expect(migration).toContain('ON CONFLICT (dedupe_id, step) DO UPDATE');
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.claim_manual_payment_side_effect'
    );
    expect(migration).toContain(
      "side_effect.claimed_at < now() - interval '60 seconds'"
    );
    expect(migration).toContain(
      'AND public.has_merchant_access(t.merchant_id)'
    );
    expect(migration).toContain(
      'AND public.has_merchant_access(side_effect.merchant_id)'
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.finish_manual_payment_side_effect'
    );
  });
});
