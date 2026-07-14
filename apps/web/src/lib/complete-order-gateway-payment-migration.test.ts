import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Contract tests for the atomic gateway paid-order completion RPC. Pure
// static assertions on the migration source (same pattern as
// manual-payment-rpc-migration.test.ts) — no SQL execution.
const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260713160000_complete_order_gateway_payment_atomic.sql'
  ),
  'utf8'
);

describe('complete_order_gateway_payment migration', () => {
  it('defines a SECURITY DEFINER function with an empty search_path', () => {
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.complete_order_gateway_payment('
    );
    expect(migrationSql).toContain('SECURITY DEFINER');
    expect(migrationSql).toMatch(/SET search_path = ''/);
  });

  it('guards execution to service_role with a null-safe check', () => {
    expect(migrationSql).toMatch(
      /IF \(SELECT auth\.role\(\)\) IS DISTINCT FROM 'service_role' THEN/
    );
  });

  it('serializes with manual payments via the shared advisory lock key', () => {
    expect(migrationSql).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(migrationSql).toContain("'baci_order_payment:' || p_order_id::text");
  });

  it('locks both rows before mutating them', () => {
    const txnSelect = migrationSql.indexOf('FROM public.transactions');
    const orderSelect = migrationSql.indexOf('FROM public.orders');
    expect(txnSelect).toBeGreaterThan(-1);
    expect(orderSelect).toBeGreaterThan(txnSelect);
    expect(migrationSql.match(/FOR UPDATE/g)?.length).toBe(2);
  });

  it('only writes gateway_response on the pending -> completed flip', () => {
    expect(migrationSql).toContain(
      'gateway_response = COALESCE(p_gateway_response, gateway_response)'
    );
    expect(migrationSql).toContain("SET status = 'completed'");
  });

  it('validates both rows before mutating anything (error returns commit)', () => {
    const orderNotFound = migrationSql.indexOf(
      "'error_code', 'ORDER_NOT_FOUND'"
    );
    const txnMutation = migrationSql.indexOf('UPDATE public.transactions');
    expect(orderNotFound).toBeGreaterThan(-1);
    expect(txnMutation).toBeGreaterThan(orderNotFound);
  });

  it('flags rather than raises for replay states', () => {
    expect(migrationSql).toContain("IF v_txn_status = 'completed' THEN");
    expect(migrationSql).toContain('v_already_completed := true;');
    expect(migrationSql).toContain("ELSIF v_prev_payment_status = 'paid' THEN");
    expect(migrationSql).toContain('v_order_already_paid := true;');
  });

  it('never flips cancelled or refunded orders back to paid', () => {
    expect(migrationSql).toContain('IF v_prev_cancelled_at IS NOT NULL');
    expect(migrationSql).toContain("v_prev_shipping_status = 'cancelled'");
    expect(migrationSql).toContain(
      "ELSIF v_prev_payment_status = 'refunded' THEN"
    );
    expect(migrationSql).toContain(
      'v_order_skipped_status := v_prev_payment_status;'
    );
  });

  it('advances shipping only from pending, preserving merchant progress', () => {
    expect(migrationSql).toMatch(
      /shipping_status = CASE\s+WHEN shipping_status = 'pending' THEN 'processing'\s+ELSE shipping_status\s+END/
    );
  });

  it('returns error codes instead of raising for expected failures', () => {
    for (const code of [
      'INVALID_ARGUMENTS',
      'TRANSACTION_NOT_FOUND',
      'ORDER_TRANSACTION_MISMATCH',
      'TRANSACTION_IN_UNEXPECTED_STATE',
      'ORDER_NOT_FOUND',
    ]) {
      expect(migrationSql).toContain(`'error_code', '${code}'`);
    }
  });

  it('revokes public access and grants only service_role', () => {
    expect(migrationSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.complete_order_gateway_payment\(uuid, uuid, jsonb, text\) FROM PUBLIC;/
    );
    expect(migrationSql).toMatch(/FROM anon;/);
    expect(migrationSql).toMatch(/FROM authenticated;/);
    expect(migrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.complete_order_gateway_payment\(uuid, uuid, jsonb, text\) TO service_role;/
    );
  });

  it('seeds a drainable outbox row for the order flip only', () => {
    expect(migrationSql).toContain('INSERT INTO public.payment_side_effects');
    expect(migrationSql).toContain("'rpc_seed_pending_drain'");
    expect(migrationSql).toContain('ON CONFLICT (order_id, step) DO NOTHING');
    // Captures on an already-paid order settle directly, outside this
    // order-scoped outbox, so they must NOT leave a seed behind.
    expect(migrationSql).toContain('IF v_order_updated THEN');
    expect(migrationSql).not.toContain(
      'IF v_order_updated OR NOT v_already_completed THEN'
    );
    const flip = migrationSql.indexOf("SET payment_status = 'paid'");
    const seed = migrationSql.indexOf(
      'INSERT INTO public.payment_side_effects'
    );
    expect(seed).toBeGreaterThan(flip);
  });

  it('extends reconciliation_review issue types with the refunded case', () => {
    expect(migrationSql).toContain('reconciliation_review_issue_type_check');
    expect(migrationSql).toContain("'payment_received_after_refund'");
    expect(migrationSql).toContain("'payment_received_after_cancellation'");
    expect(migrationSql).toMatch(/\)\)\s+NOT VALID;/);
    expect(migrationSql).toContain(
      'VALIDATE CONSTRAINT reconciliation_review_issue_type_check'
    );
  });

  it('reports previous and post-update order state for rollback callers', () => {
    expect(migrationSql).toContain(
      "'previous_payment_status', v_prev_payment_status"
    );
    expect(migrationSql).toContain(
      "'previous_shipping_status', v_prev_shipping_status"
    );
    expect(migrationSql).toContain("'payment_status', v_post_payment_status");
    expect(migrationSql).toContain("'order_updated', v_order_updated");
  });
});
