-- Phase A — A2 follow-up #1 (PR #1569 review fixes)
--
-- Two findings from Codex review on PR #1569:
--
--   Δ-86 (P1, claim_paystack_paid_atomic): the duplicate-cancel UPDATEs
--     scope by `id = ANY(p_cancel_order_ids)` only — no merchant_id
--     check. A typo'd UUID in `--cancel-orders` would silently cancel
--     another tenant's pending order (and its pending transaction).
--     Manual recovery is the highest-blast-radius caller; one wrong UUID
--     must be rejected, not propagated. Fix: load merchant_id from the
--     canonical order under FOR UPDATE, then constrain both cancel
--     UPDATEs to `merchant_id = <canonical>` and exclude the canonical
--     order id from the array (defensive — avoid self-cancel if it
--     leaks into --cancel-orders).
--
--   Δ-87 (P2, all three privileged RPCs): `auth.role() <> 'service_role'`
--     evaluates to NULL when `auth.role()` is NULL, so the RAISE branch
--     is skipped. The defense-in-depth guard becomes a no-op against
--     unauthenticated callers if ACLs are ever broadened. Fix: use the
--     null-safe `IS DISTINCT FROM` operator so NULL values trip the
--     guard. Apply consistently to `claim_paystack_paid_atomic` (this
--     PR), `record_merchant_settlement` (PR #1562), and
--     `claim_payment_side_effect` (PR #1563) — all three are already in
--     prod with the unsafe form. Prior precedent in baseline:
--     `COALESCE(auth.role(), '') <> 'service_role'` does the same job.
--
-- Migration strategy: CREATE OR REPLACE FUNCTION with the unchanged
-- signature preserves ACLs (REVOKE/GRANT from prior migrations remain
-- in effect). No DROP needed. Bodies copied from
-- `20260510160000_claim_paystack_paid_atomic_rpc.sql`,
-- `20260510000100_finalize_settlement_signature_and_review_policy.sql`,
-- and `20260510120000_payment_side_effects.sql` with only the role-guard
-- and (for the atomic RPC) tenant-scope changes.

-- ---------- Δ-87 + Δ-86: claim_paystack_paid_atomic ----------
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
  -- Δ-87: null-safe role guard. `<>` returns NULL when either side is
  -- NULL, which would skip the RAISE; `IS DISTINCT FROM` treats NULL
  -- as "different from 'service_role'" and trips the guard.
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

  -- Δ-86: load merchant_id alongside payment_status so the cancel
  -- UPDATEs below can scope by tenant.
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

  -- Δ-86: tenant-scoped cancel for duplicate orders. A typo'd UUID in
  -- p_cancel_order_ids that resolves to another merchant's order will
  -- match neither the merchant_id filter nor the canonical-id exclusion,
  -- so it silently no-ops instead of mutating a stranger's row. The
  -- canonical exclusion is defensive — if the canonical order id ever
  -- leaks into the cancel array we don't want to cancel the order we
  -- just flipped to paid.
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

  -- Δ-86: same tenant scoping on the duplicate-transaction cancel.
  -- transactions.merchant_id is denormalized from the order it points
  -- at, so this filter is consistent with the orders one above.
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
     AND order_id IS DISTINCT FROM p_canonical_order_id
     AND merchant_id = v_canonical_merchant_id
     AND status = 'pending';
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

-- ---------- Δ-87: record_merchant_settlement (10-arg) ----------
-- Body verbatim from 20260510000100; only the role guard changes.
-- CREATE OR REPLACE on identical signature preserves the REVOKE/GRANT
-- already applied by 20260510001000_relock_settlement_10arg_acl.sql.
CREATE OR REPLACE FUNCTION public.record_merchant_settlement(
  p_merchant_id       uuid,
  p_source_type       text,
  p_source_id         uuid,
  p_gateway           text,
  p_gateway_reference text,
  p_gross_amount      numeric,
  p_gateway_fee       numeric,
  p_platform_fee      numeric,
  p_description       text,
  p_metadata          jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wallet_id      UUID;
  v_net_amount     DECIMAL(12,2);
  v_expected_date  DATE;
  v_settlement_id  UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden: record_merchant_settlement requires service_role';
  END IF;

  v_wallet_id := get_or_create_merchant_wallet(p_merchant_id);
  v_net_amount := p_gross_amount - p_gateway_fee - p_platform_fee;
  v_expected_date := calculate_settlement_date(p_gateway);

  INSERT INTO merchant_settlements (
    merchant_id, wallet_id, source_type, source_id, gateway,
    gateway_reference, gross_amount, gateway_fee, platform_fee, net_amount,
    payment_date, expected_settlement_date, description, status, metadata
  ) VALUES (
    p_merchant_id, v_wallet_id, p_source_type, p_source_id, p_gateway,
    p_gateway_reference, p_gross_amount, p_gateway_fee, p_platform_fee,
    v_net_amount, NOW(), v_expected_date,
    COALESCE(p_description, 'Payment received'),
    CASE WHEN p_gateway = 'korapay' THEN 'settled' ELSE 'pending' END,
    p_metadata
  )
  ON CONFLICT (source_type, source_id, gateway_reference)
    WHERE gateway_reference IS NOT NULL AND status != 'cancelled'
    DO NOTHING
  RETURNING id INTO v_settlement_id;

  IF v_settlement_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_gateway != 'korapay' THEN
    UPDATE merchant_wallets
       SET upcoming_balance = upcoming_balance + v_net_amount,
           upcoming_count   = upcoming_count + 1,
           updated_at       = NOW()
     WHERE id = v_wallet_id;
  ELSE
    UPDATE merchant_wallets
       SET available_balance = available_balance + v_net_amount,
           total_earned      = total_earned + v_net_amount,
           updated_at        = NOW()
     WHERE id = v_wallet_id;

    INSERT INTO wallet_transactions (
      wallet_id, merchant_id, type, amount, balance_after,
      source_type, source_id, description, status
    )
    SELECT
      v_wallet_id, p_merchant_id, 'credit', v_net_amount, mw.available_balance,
      p_source_type, p_source_id,
      COALESCE(p_description, 'Payment settled'), 'completed'
    FROM merchant_wallets mw WHERE mw.id = v_wallet_id;
  END IF;

  RETURN v_settlement_id;
END $$;

-- ---------- Δ-87: claim_payment_side_effect ----------
-- Body verbatim from 20260510120000_payment_side_effects.sql; only the
-- role guard changes. CREATE OR REPLACE preserves REVOKE/GRANT.
CREATE OR REPLACE FUNCTION public.claim_payment_side_effect(
  p_order_id       uuid,
  p_transaction_id uuid,
  p_step           text,
  p_claim_token    uuid,
  p_claimed_by     text
) RETURNS TABLE (we_won boolean, current_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden: claim_payment_side_effect requires service_role';
  END IF;

  INSERT INTO payment_side_effects
    (order_id, transaction_id, step, status, claim_token, claimed_by)
  VALUES
    (p_order_id, p_transaction_id, p_step, 'claimed', p_claim_token, p_claimed_by)
  ON CONFLICT (order_id, step) DO UPDATE
    SET claim_token = EXCLUDED.claim_token,
        claimed_by  = EXCLUDED.claimed_by,
        claimed_at  = now(),
        status      = 'claimed',
        attempts    = payment_side_effects.attempts + 1
    WHERE payment_side_effects.status = 'failed'
       OR (payment_side_effects.status = 'claimed'
           AND payment_side_effects.claimed_at < now() - interval '60 seconds');

  RETURN QUERY
  SELECT (pse.claim_token = p_claim_token) AS we_won,
         pse.status                        AS current_status
    FROM payment_side_effects pse
   WHERE pse.order_id = p_order_id
     AND pse.step     = p_step;
END $$;
