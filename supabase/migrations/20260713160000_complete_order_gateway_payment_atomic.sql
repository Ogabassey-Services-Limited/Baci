-- Atomic, idempotent completion for gateway order payments (Paystack/Korapay
-- webhook and the reconcile sweep). Fixes the wedge class behind incident
-- ORD-260711-00NT-5: transaction completed at 17:25:10Z, the separate order
-- update crashed, and gateway retries short-circuited on the completed
-- transaction forever.
--
-- Scope of the guarantee: the ORDER flip (and, for callers that have not
-- already claimed the transaction, the transaction flip too) commits in one
-- database transaction here. The webhook's first delivery still claims the
-- transaction in its own earlier statement, so a crash between that claim and
-- this RPC remains possible — but it is now self-healing: replays return
-- flags (already_completed / order_already_paid) instead of raising, and the
-- webhook redelivery path plus the reconcile-gateway-paid-orders cron re-run
-- this RPC until the order state converges.

CREATE OR REPLACE FUNCTION public.complete_order_gateway_payment(
  p_transaction_id uuid,
  p_order_id uuid,
  p_gateway_response jsonb DEFAULT NULL,
  p_actor text DEFAULT 'gateway_webhook'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_txn_status text;
  v_txn_order_id uuid;
  v_prev_payment_status text;
  v_prev_shipping_status text;
  v_prev_cancelled_at timestamptz;
  v_order_number text;
  v_already_completed boolean := false;
  v_order_already_paid boolean := false;
  v_order_updated boolean := false;
  v_order_cancelled boolean := false;
  v_order_skipped_status text := NULL;
  v_post_payment_status text;
  v_post_shipping_status text;
  v_post_cancelled_at timestamptz;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden: complete_order_gateway_payment requires service_role';
  END IF;

  IF p_transaction_id IS NULL OR p_order_id IS NULL THEN
    RETURN jsonb_build_object('error_code', 'INVALID_ARGUMENTS');
  END IF;

  -- Same advisory key as record_manual_order_payment so gateway completion
  -- and manual payment recording serialize per order.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('baci_order_payment:' || p_order_id::text, 0)
  );

  SELECT status, order_id
    INTO v_txn_status, v_txn_order_id
    FROM public.transactions
   WHERE id = p_transaction_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error_code', 'TRANSACTION_NOT_FOUND');
  END IF;

  IF v_txn_order_id IS DISTINCT FROM p_order_id THEN
    RETURN jsonb_build_object('error_code', 'ORDER_TRANSACTION_MISMATCH');
  END IF;

  IF v_txn_status NOT IN ('completed', 'pending') THEN
    RETURN jsonb_build_object(
      'error_code', 'TRANSACTION_IN_UNEXPECTED_STATE',
      'transaction_status', v_txn_status
    );
  END IF;

  -- Lock and validate the order BEFORE any mutation: an error-code RETURN
  -- does not roll back, so mutating the transaction first would commit a
  -- partial flip on the ORDER_NOT_FOUND path.
  SELECT payment_status, shipping_status, cancelled_at, order_number
    INTO v_prev_payment_status, v_prev_shipping_status, v_prev_cancelled_at,
         v_order_number
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error_code', 'ORDER_NOT_FOUND');
  END IF;

  IF v_txn_status = 'completed' THEN
    v_already_completed := true;
  ELSE
    -- Only the pending->completed flip may write gateway_response; a replay
    -- must not overwrite the payload captured at completion time.
    UPDATE public.transactions
       SET status = 'completed',
           gateway_response = COALESCE(p_gateway_response, gateway_response),
           updated_at = now()
     WHERE id = p_transaction_id;
  END IF;

  IF v_prev_cancelled_at IS NOT NULL
     OR v_prev_shipping_status = 'cancelled'
     OR v_prev_payment_status = 'cancelled' THEN
    -- prevent_cancelled_order_reopen would clamp this flip anyway; skip the
    -- write and surface the state so callers file a refund review.
    v_order_cancelled := true;
  ELSIF v_prev_payment_status = 'paid' THEN
    v_order_already_paid := true;
  ELSIF v_prev_payment_status = 'refunded' THEN
    -- A late gateway redelivery must never resurrect a refunded order.
    v_order_skipped_status := v_prev_payment_status;
  ELSE
    UPDATE public.orders
       SET payment_status = 'paid',
           shipping_status = CASE
             WHEN shipping_status = 'pending' THEN 'processing'
             ELSE shipping_status
           END,
           updated_at = now()
     WHERE id = p_order_id;
    v_order_updated := true;
  END IF;

  SELECT payment_status, shipping_status, cancelled_at
    INTO v_post_payment_status, v_post_shipping_status, v_post_cancelled_at
    FROM public.orders
   WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'already_completed', v_already_completed,
    'order_already_paid', v_order_already_paid,
    'order_updated', v_order_updated,
    'order_cancelled', v_order_cancelled,
    'order_skipped_status', v_order_skipped_status,
    'previous_payment_status', v_prev_payment_status,
    'previous_shipping_status', v_prev_shipping_status,
    'payment_status', v_post_payment_status,
    'shipping_status', v_post_shipping_status,
    'cancelled_at', v_post_cancelled_at,
    'order_number', v_order_number,
    'actor', p_actor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_order_gateway_payment(uuid, uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_order_gateway_payment(uuid, uuid, jsonb, text) FROM anon;
REVOKE ALL ON FUNCTION public.complete_order_gateway_payment(uuid, uuid, jsonb, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_order_gateway_payment(uuid, uuid, jsonb, text) TO service_role;

-- A late gateway payment can land on an order that was refunded in the
-- interim; the finalizer files it for manual review rather than resurrecting
-- the order, so the review queue needs the new issue type.
ALTER TABLE public.reconciliation_review
  DROP CONSTRAINT IF EXISTS reconciliation_review_issue_type_check;
ALTER TABLE public.reconciliation_review
  ADD CONSTRAINT reconciliation_review_issue_type_check CHECK (issue_type IN (
    'payment_match_ambiguous',
    'payment_match_zero_candidates',
    'manage_stock_cancellation_held',
    'tax_basis_unclassified',
    'tax_basis_inconsistent_total',
    'wallet_dva_order_alias_conflict',
    'customer_savings_auto_debit_allocation_failed',
    'wallet_order_funding_ambiguous',
    'wallet_order_funding_conflict',
    'wallet_order_funding_finalize_failed',
    'payment_received_after_cancellation',
    'payment_received_after_refund',
    'serialized_inventory_confirmation_failed'
  ));
