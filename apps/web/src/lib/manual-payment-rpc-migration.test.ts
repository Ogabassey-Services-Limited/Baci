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
  });

  it('keeps the transaction insert and order update inside the locked RPC', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('INSERT INTO public.transactions');
    expect(migration).toContain('UPDATE public.orders AS o');
  });
});
