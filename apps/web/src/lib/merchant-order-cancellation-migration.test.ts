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
});
