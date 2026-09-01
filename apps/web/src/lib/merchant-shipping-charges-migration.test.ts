import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  `${process.cwd()}/../../supabase/migrations/20260901192000_add_merchant_shipping_charges.sql`,
  'utf8'
);

describe('merchant shipping charge migration contract', () => {
  it('defines the owner-checked idempotent charge ledger and five RPCs', () => {
    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS public.merchant_shipping_charges'
    );
    expect(sql).toContain(
      'ADD COLUMN IF NOT EXISTS provider_cost numeric(12,2)'
    );
    expect(sql).toContain(
      'ADD COLUMN IF NOT EXISTS platform_margin numeric(12,2)'
    );
    expect(sql).toContain('shipments_provider_cost_nonnegative');
    expect(sql).toContain('shipments_platform_margin_nonnegative');
    expect(sql).toContain('UNIQUE(order_id, shipping_quote_id)');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('merchant_id = auth.uid()');
    expect(sql).toContain("provider='GIGL'");
    expect(sql).toContain("currency='NGN'");
    expect(sql).toContain("shipping_funding_source <> 'merchant_wallet'");
    expect(sql).toContain("'gigl_shipping'");
    expect(sql).toContain('MERCHANT_WALLET_INSUFFICIENT');
    expect(sql).toContain("extensions.digest(p_attempt_token,'sha256')");
    for (const fn of [
      'reserve_merchant_shipping_charge',
      'begin_merchant_shipping_charge_submission',
      'complete_merchant_shipping_charge',
      'refund_merchant_shipping_charge',
      'mark_merchant_shipping_charge_for_reconciliation',
    ])
      expect(sql).toContain(`FUNCTION public.${fn}`);
  });

  it('checks the refund token before refunded terminal idempotency', () => {
    const refund = sql.slice(
      sql.indexOf(
        'CREATE OR REPLACE FUNCTION public.refund_merchant_shipping_charge'
      )
    );
    expect(refund.indexOf('attempt_token_digest <>')).toBeLessThan(
      refund.indexOf("status='refunded'")
    );
  });
});
