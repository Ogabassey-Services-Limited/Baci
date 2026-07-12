import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function migration(name: string) {
  return readFileSync(
    resolve(process.cwd(), `../../supabase/migrations/${name}`),
    'utf8'
  );
}

describe('Petrock remediation migrations', () => {
  it('keeps the curated product catalog private and human-approved', () => {
    const sql = migration('20260711202000_petrock_remediation_catalog.sql');
    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS public.petrock_remediation_products'
    );
    expect(sql).toContain(
      "review_status IN ('pending', 'approved', 'rejected')"
    );
    expect(sql).toContain('manual_disabled boolean NOT NULL DEFAULT false');
    expect(sql).toContain(
      'REVOKE ALL ON public.petrock_remediation_products FROM PUBLIC, anon, authenticated'
    );
    expect(sql).toContain("SET search_path TO ''");
    expect(sql).not.toContain('SET search_path = public, pg_temp');
    expect(sql).toContain('v_material_change boolean');
    expect(sql).toContain(
      "review_status = CASE WHEN v_material_change THEN 'pending'"
    );
    expect(sql).toContain(
      'fixture_verified = CASE WHEN v_material_change THEN false'
    );
    expect(sql).toContain(
      'UPDATE public.petrock_remediation_products p\n  SET is_active = false'
    );
  });

  it('creates the order state machine, audit events, and a column-safe customer view', () => {
    const sql = migration('20260711202100_petrock_remediation_orders.sql');
    for (const status of [
      'eligibility_pending',
      'payment_pending',
      'paid',
      'submitting',
      'submitted',
      'in_progress',
      'completed',
      'refund_pending',
      'refunded',
      'submission_unknown',
    ]) {
      expect(sql).toContain(`'${status}'`);
    }
    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS public.petrock_order_events'
    );
    expect(sql).toContain('CREATE VIEW public.petrock_order_customer_status');
    expect(sql).toContain(
      'WITH (security_invoker = true, security_barrier = true)'
    );
    expect(sql).toContain('CREATE POLICY customer_reads_own_petrock_orders');
    expect(sql).toContain('email_notification_claim_token uuid');
    expect(sql).toContain('push_notification_claim_token uuid');
    expect(sql).not.toMatch(
      /CREATE VIEW public\.petrock_order_customer_status[\s\S]+(?:feedback_token_hash|identifier_ciphertext|cost_usd)/i
    );
  });

  it('captures and refunds NGN or USDT atomically through service-role RPCs', () => {
    const sql = migration('20260711202200_petrock_remediation_wallet_rpcs.sql');
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.redeem_wallet_for_remediation'
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.refund_wallet_for_remediation'
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.prepare_petrock_remediation_order'
    );
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain(
      'v_product.price_ngn < v_product.cost_usd * p_fx_rate'
    );
    expect(sql).toContain('v_product.price_usdt < v_product.cost_usd');
    expect(sql).toContain(
      'total_redeemed = GREATEST(total_redeemed - v_order.amount_ngn, 0)'
    );
    expect(sql).toContain(
      'total_debited = GREATEST(total_debited - v_order.amount_usdt, 0)'
    );
    expect(sql).toContain("SET search_path TO ''");
    expect(sql).not.toContain('SET search_path = public, pg_temp');
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]+TO authenticated/is);
  });

  it('leases, advances, and terminally resolves remediation work atomically', () => {
    const sql = [
      '20260711202300_petrock_remediation_reconciliation_rpcs.sql',
      '20260712143000_petrock_review_recovery_hardening.sql',
    ]
      .map(migration)
      .join('\n');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.begin_petrock_eligibility_check'
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.advance_petrock_eligibility_evidence'
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.finalize_petrock_remediation_order'
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.fail_petrock_remediation_before_acceptance'
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.claim_petrock_remediation_notification'
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.complete_petrock_remediation_notification'
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.clear_petrock_remediation_notification'
    );
    expect(sql).toContain('p_claim_token uuid');
    expect(sql).toContain('email_notification_claim_until < now()');
    expect(sql).toContain('push_notification_claim_until < now()');
    expect(sql).toContain('p_lease_token IS NULL');
    expect(sql).toContain(
      "v_order.status NOT IN ('submitted', 'in_progress', 'submission_unknown')"
    );
    expect(sql).toContain(
      "o.status = 'paid' AND o.paid_at < now() - interval '2 minutes'"
    );
    expect(sql).toContain("'submission_unknown'");
    expect(sql).toContain('provider_order_id = COALESCE');
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.record_juicyway_usdt_deposit_address'
    );
    expect(sql).toContain("AND status = 'pending'");
    expect(sql).toContain('PERFORM public.refund_wallet_for_remediation');
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.finalize_petrock_remediation_order(uuid, text, boolean, text, text) TO service_role'
    );
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]+TO authenticated/is);
    expect(sql).toContain("SET search_path TO ''");
    expect(sql).not.toContain('SET search_path = public, pg_temp');
  });
});
