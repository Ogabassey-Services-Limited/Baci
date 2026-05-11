-- Phase A — A2 migration (Δ-8, Δ-11, Δ-12, Δ-13, Δ-15, Δ-18, Δ-19, Δ-23,
-- Δ-25, Δ-28, Δ-67).
--
-- The atomic-claim RPC for "Paystack confirmed this payment but our DB
-- still says pending". Replaces the impossible "BEGIN/COMMIT across
-- separate Supabase JS calls" sketch with a single PL/pgSQL function.
--
-- Generalized so PR3's manual reconcile script and PR9's B1/B4 cron can
-- both call it: pass `p_cancel_order_ids` to also cancel duplicate orders
-- (manual flow), or pass `'{}'::uuid[]` to skip (automated flow). Pass
-- `p_operator_user_id` non-NULL to write `audit_logs`; pass NULL to skip
-- (audit_logs.user_id is NOT NULL — Δ-13/Δ-25 sidesteps the brittle
-- "provision a system user" path).
--
-- Param order (Δ-18): required-first, defaulted-last. Postgres rejects
-- defaulted-then-required parameter ordering at function-definition time.

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
  v_txn_rows_updated      INT;
  v_order_rows_updated    INT;
  v_dup_orders_cancelled  INT;
  v_dup_txns_cancelled    INT;
  v_already_completed     BOOLEAN := false;
  v_order_already_paid    BOOLEAN := false;
BEGIN
  -- Δ-67: defense-in-depth role guard. REVOKE/GRANT below restricts the
  -- function to service_role; this guard catches future grant slip-ups.
  -- Mirrors `claim_payment_side_effect` (A1) and `record_merchant_settlement`
  -- (A0) — every privileged SECURITY DEFINER public-schema RPC in this
  -- recovery sequence opens with the same check.
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: claim_paystack_paid_atomic requires service_role';
  END IF;

  -- Read the transaction state for invariant checking. SELECT … FOR UPDATE
  -- locks the row so no concurrent invocation flips it under us.
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

  -- Δ-15: idempotent re-state handling for the transaction. `completed`
  -- is a safe replay (continue and ensure order is paid + duplicates
  -- cancelled); `pending` is the normal path; anything else is bad state.
  IF v_txn_existing_status = 'completed' THEN
    v_already_completed := true;
  ELSIF v_txn_existing_status NOT IN ('pending') THEN
    RAISE EXCEPTION 'transaction_in_unexpected_state: %', v_txn_existing_status;
  END IF;

  -- Δ-23: validate canonical order state under lock. Allow `pending`
  -- (we will flip it) and `paid` (idempotent replay). Anything else
  -- (cancelled, refunded, unknown) means we are about to corrupt
  -- already-finalized state and must abort.
  SELECT payment_status INTO v_order_existing_status
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

  -- Flip transaction → completed. The `AND status = 'pending'` predicate
  -- means the safe-replay branch for an already-completed txn updates 0
  -- rows; v_txn_rows_updated == 0 is acceptable iff v_already_completed.
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

  -- Δ-28: mirror the existing payment-flow shipping transition (webhook
  -- route line 1501 and verify route line 271 both set
  -- shipping_status='processing' when payment moves to paid; preserve
  -- already-progressed shipping in the safe-replay path).
  UPDATE orders
     SET payment_status  = 'paid',
         shipping_status = CASE
           WHEN shipping_status = 'pending' THEN 'processing'
           ELSE shipping_status
         END,
         updated_at = now()
   WHERE id = p_canonical_order_id AND payment_status = 'pending';
  GET DIAGNOSTICS v_order_rows_updated = ROW_COUNT;

  -- Cancel duplicate orders. Empty array means automated paths (B1/B4)
  -- skip this entirely; manual A2 passes the duplicates explicitly.
  UPDATE orders
     SET payment_status = 'cancelled',
         shipping_status = 'cancelled',
         notes = COALESCE(notes, '') ||
                 E'\n[auto] Cancelled — duplicate of canonical paid order',
         updated_at = now()
   WHERE id = ANY(p_cancel_order_ids)
     AND payment_status = 'pending';
  GET DIAGNOSTICS v_dup_orders_cancelled = ROW_COUNT;

  -- Δ-11: cancel pending transactions tied to cancelled duplicates.
  -- transactions.status enum already permits 'cancelled' per baseline.
  UPDATE transactions
     SET status = 'cancelled',
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'cancelled_reason', 'duplicate_of_paid_order',
           'canonical_transaction_id', p_transaction_id,
           'cancelled_at', now(),
           'cancelled_by', p_operator_label
         ),
         updated_at = now()
   WHERE order_id = ANY(p_cancel_order_ids)
     AND status = 'pending';
  GET DIAGNOSTICS v_dup_txns_cancelled = ROW_COUNT;

  -- Δ-13/Δ-25: audit_logs.user_id is NOT NULL. Manual reconcile paths
  -- (A2 script) pass the operator's auth.users.id; automated paths
  -- (B1 webhook, B4 cron) pass NULL and rely on transactions.metadata +
  -- payment_side_effects rows as the audit trail. Sidesteps the brittle
  -- "provision a system user in auth.users" pattern.
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

-- Δ-19: lock down the privileged RPC. This function flips order/payment
-- state and cancels transactions — only service_role may execute it.
-- Pattern mirrors `record_merchant_settlement` (A0) and
-- `claim_payment_side_effect` (A1).
REVOKE EXECUTE ON FUNCTION public.claim_paystack_paid_atomic(
  uuid, text, jsonb, uuid, uuid, uuid[], text
) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_paystack_paid_atomic(
  uuid, text, jsonb, uuid, uuid, uuid[], text
) TO service_role;

COMMENT ON FUNCTION public.claim_paystack_paid_atomic(
  uuid, text, jsonb, uuid, uuid, uuid[], text
) IS
  'Atomic claim "Paystack confirmed paid → flip our DB". Returns counts so callers can detect already-completed replays. Manual reconcile (A2 script) passes operator user_id + cancel_order_ids; automated paths (B1 webhook, B4 cron) pass NULL + empty array.';
