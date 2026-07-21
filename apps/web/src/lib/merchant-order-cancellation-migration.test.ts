import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260721093206_merchant_order_cancellation_audit.sql'
  ),
  'utf8'
);

describe('merchant order cancellation migration', () => {
  it('records canonical cancellation state and the authenticated actor', () => {
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.cancel_order_as_merchant('
    );
    expect(migrationSql).toContain('v_actor uuid := (SELECT auth.uid())');
    expect(migrationSql).toContain("cancelled_by = 'merchant'");
    expect(migrationSql).toContain('cancelled_at = now()');
    expect(migrationSql).toContain('INSERT INTO public.order_audit_events');
    expect(migrationSql).toContain(
      "public.check_staff_permission(\n      v_actor,\n      v_order.merchant_id,\n      'orders',\n      'edit'"
    );
  });

  it('rejects fulfilled orders and safely restores tracked inventory only', () => {
    expect(migrationSql).toContain(
      "v_order.shipping_status IN ('cancelled', 'canceled')"
    );
    expect(migrationSql).toContain('OR v_order.cancelled_at IS NOT NULL');
    expect(migrationSql).toContain(
      "v_order.shipping_status IN ('shipped', 'delivered', 'completed', 'returned')"
    );
    expect(migrationSql).toContain('private.restock_order_items(p_order_id)');
    expect(migrationSql).toContain('paid_order_ledger_inconsistent');
  });

  it('voids unpaid payment instruments and exposes the RPC only to authenticated users', () => {
    expect(migrationSql).toContain('UPDATE public.order_payment_accounts');
    expect(migrationSql).toContain(
      'UPDATE public.order_wallet_funding_intents'
    );
    expect(migrationSql).toMatch(/GRANT EXECUTE[\s\S]*TO authenticated/);
  });

  it('persists and claims cancellation side effects idempotently', () => {
    expect(migrationSql).toContain(
      'CREATE TABLE IF NOT EXISTS public.order_cancellation_side_effects'
    );
    expect(migrationSql).toContain('PRIMARY KEY (order_id, step)');
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.claim_order_cancellation_side_effect('
    );
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.finish_order_cancellation_side_effect('
    );
    expect(migrationSql).toContain("side_effect.status = 'failed'");
    expect(migrationSql).toContain(
      "p_status NOT IN ('completed', 'failed', 'delivery_uncertain')"
    );
    expect(migrationSql).toContain("t.transaction_type = 'refund'");
  });
});
