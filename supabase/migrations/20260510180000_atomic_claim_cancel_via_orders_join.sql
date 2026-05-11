-- Phase A — A2 follow-up #2 (PR #1569 round-2 review fix)
--
-- Δ-90 (CodeRabbit P3, minor): `claim_paystack_paid_atomic`'s
-- duplicate-transaction cancel UPDATE filters by `merchant_id =
-- v_canonical_merchant_id`, which depends on the denormalized
-- `transactions.merchant_id` matching `orders.merchant_id`. There is
-- no CHECK constraint enforcing that invariant; if a transaction row
-- ever has a mismatched merchant_id, the filter silently fails to
-- match it and the cancel leaks a pending transaction tied to a
-- cancelled order.
--
-- Fix: rewrite the duplicate-transaction cancel to join through
-- `orders.merchant_id` (the canonical owner field) instead of
-- trusting `transactions.merchant_id`. Same fix shape applied to the
-- duplicate-order cancel for parity, even though `orders.merchant_id`
-- is itself the source of truth — keeping both UPDATEs structured the
-- same way makes the invariant obvious to future readers.
--
-- Migration strategy: `CREATE OR REPLACE FUNCTION` on identical
-- signature preserves the REVOKE/GRANT from prior migrations. Body
-- copied from 20260510170000 with only the two cancel UPDATEs
-- changed; null-safe role guard and tenant-scoped order load are
-- preserved verbatim.

CREATE OR REPLACE FUNCTION public.claim_paystack_paid_atomic(
  p_transaction_id     uuid,
  p_paystack_reference text,
  p_gateway_response   jsonb,
  p_canonical_order_id uuid,
  p_operator_user_id   uuid,
  p_cancel_order_ids   uuid[] DEFAULT '{}'::uuid[],
  p_operator_label     text   DEFAULT 'manual_reconcile'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_txn_existing_status   TEXT;
  v_txn_existing_order_id UUID;
  v_order_existing_status TEXT;
  v_canonical_merchant_id UUID;
  v_txn_rows_updated      INT;
  v_order_rows_updated    INT;
  v_dup_orders_cancelled  INT;
  v_dup_txns_cancelled    INT;
  v_already_completed     BOOLEAN := false;
  v_order_already_paid    BOOLEAN := false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden: claim_paystack_paid_atomic requires service_role';
  END IF;

  SELECT status, order_id
    INTO v_txn_existing_status, v_txn_existing_order_id
    FROM transactions WHERE id = p_transaction_id FOR UPDATE;

  IF v_txn_existing_status IS NULL THEN
    RAISE EXCEPTION 'transaction_not_found: %', p_transaction_id;
  END IF;

  IF v_txn_existing_order_id IS DISTINCT FROM p_canonical_order_id THEN
    RAISE EXCEPTION
      'transaction_order_link_mismatch: txn % is for order %, got %',
      p_transaction_id, v_txn_existing_order_id, p_canonical_order_id;
  END IF;

  IF v_txn_existing_status = 'completed' THEN
    v_already_completed := true;
  ELSIF v_txn_existing_status NOT IN ('pending') THEN
    RAISE EXCEPTION 'transaction_in_unexpected_state: %', v_txn_existing_status;
  END IF;

  SELECT payment_status, merchant_id
    INTO v_order_existing_status, v_canonical_merchant_id
    FROM orders WHERE id = p_canonical_order_id FOR UPDATE;

  IF v_order_existing_status IS NULL THEN
    RAISE EXCEPTION 'canonical_order_not_found: %', p_canonical_order_id;
  ELSIF v_order_existing_status = 'paid' THEN
    v_order_already_paid := true;
  ELSIF v_order_existing_status NOT IN ('pending') THEN
    RAISE EXCEPTION
      'canonical_order_in_unexpected_state: % (allowed: pending | paid)',
      v_order_existing_status;
  END IF;

  UPDATE transactions
     SET status = 'completed',
         gateway_response = p_gateway_response,
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'paystack_reference', p_paystack_reference,
           'reconciled_at', now(),
           'reconciled_by', p_operator_label
         ),
         updated_at = now()
   WHERE id = p_transaction_id AND status = 'pending';
  GET DIAGNOSTICS v_txn_rows_updated = ROW_COUNT;

  UPDATE orders
     SET payment_status  = 'paid',
         shipping_status = CASE
           WHEN shipping_status = 'pending' THEN 'processing'
           ELSE shipping_status
         END,
         updated_at = now()
   WHERE id = p_canonical_order_id AND payment_status = 'pending';
  GET DIAGNOSTICS v_order_rows_updated = ROW_COUNT;

  -- Δ-90: cancel duplicate orders via orders.merchant_id directly.
  -- Same shape as the transaction-cancel below so both UPDATEs make
  -- the tenant invariant obvious at a glance.
  UPDATE orders
     SET payment_status = 'cancelled',
         shipping_status = 'cancelled',
         notes = COALESCE(notes, '') ||
                 E'\n[auto] Cancelled — duplicate of canonical paid order',
         updated_at = now()
   WHERE id = ANY(p_cancel_order_ids)
     AND id IS DISTINCT FROM p_canonical_order_id
     AND merchant_id = v_canonical_merchant_id
     AND payment_status = 'pending';
  GET DIAGNOSTICS v_dup_orders_cancelled = ROW_COUNT;

  -- Δ-90: cancel duplicate transactions by joining through orders.
  -- Previous version filtered by `transactions.merchant_id`, which
  -- depends on the denormalized field staying in sync with the order.
  -- No CHECK constraint enforces that, so a mismatched txn would
  -- silently slip through. Going via orders.merchant_id makes the
  -- cancellation impossible to miss even if denormalization drifts.
  UPDATE transactions t
     SET status = 'cancelled',
         metadata = COALESCE(t.metadata, '{}'::jsonb) || jsonb_build_object(
           'cancelled_reason', 'duplicate_of_paid_order',
           'canonical_transaction_id', p_transaction_id,
           'cancelled_at', now(),
           'cancelled_by', p_operator_label
         ),
         updated_at = now()
    FROM orders o
   WHERE t.order_id = o.id
     AND o.id = ANY(p_cancel_order_ids)
     AND o.id IS DISTINCT FROM p_canonical_order_id
     AND o.merchant_id = v_canonical_merchant_id
     AND t.status = 'pending';
  GET DIAGNOSTICS v_dup_txns_cancelled = ROW_COUNT;

  IF p_operator_user_id IS NOT NULL THEN
    INSERT INTO audit_logs (
      action, resource_type, resource_id, changes, status, user_id
    )
    VALUES (
      p_operator_label,
      'transaction',
      p_transaction_id::text,
      jsonb_build_object(
        'paystack_reference',     p_paystack_reference,
        'canonical_order_id',     p_canonical_order_id,
        'cancel_order_ids',       to_jsonb(p_cancel_order_ids),
        'txn_rows_updated',       v_txn_rows_updated,
        'order_rows_updated',     v_order_rows_updated,
        'dup_orders_cancelled',   v_dup_orders_cancelled,
        'dup_txns_cancelled',     v_dup_txns_cancelled,
        'already_completed',      v_already_completed,
        'order_already_paid',     v_order_already_paid
      ),
      'success',
      p_operator_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'canonical_order_id',   p_canonical_order_id,
    'reconciled_at',        now(),
    'already_completed',    v_already_completed,
    'order_already_paid',   v_order_already_paid,
    'txn_rows_updated',     v_txn_rows_updated,
    'order_rows_updated',   v_order_rows_updated,
    'dup_orders_cancelled', v_dup_orders_cancelled,
    'dup_txns_cancelled',   v_dup_txns_cancelled
  );
END $$;
