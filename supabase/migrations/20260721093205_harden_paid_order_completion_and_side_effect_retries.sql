-- Keep the order payment ledger consistent with the gateway transaction and
-- prevent a deterministic side-effect failure from being retried forever.

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
  v_gateway_paid_at timestamptz := now();
  v_already_completed boolean := false;
  v_order_already_paid boolean := false;
  v_order_updated boolean := false;
  v_order_ledger_healed boolean := false;
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

  BEGIN
    v_gateway_paid_at := COALESCE(
      NULLIF(p_gateway_response ->> 'paid_at', '')::timestamptz,
      NULLIF(p_gateway_response ->> 'paidAt', '')::timestamptz,
      now()
    );
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    v_gateway_paid_at := now();
  END;

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
    UPDATE public.transactions
       SET status = 'completed',
           gateway_response = COALESCE(p_gateway_response, gateway_response),
           updated_at = now()
     WHERE id = p_transaction_id;
  END IF;

  IF v_prev_cancelled_at IS NOT NULL
     OR v_prev_shipping_status = 'cancelled'
     OR v_prev_payment_status = 'cancelled' THEN
    v_order_cancelled := true;
  ELSIF v_prev_payment_status = 'paid' THEN
    v_order_already_paid := true;
    UPDATE public.orders
       SET amount_paid = total,
           paid_at = COALESCE(paid_at, v_gateway_paid_at),
           updated_at = CASE
             WHEN amount_paid IS DISTINCT FROM total OR paid_at IS NULL
               THEN now()
             ELSE updated_at
           END
     WHERE id = p_order_id
       AND (amount_paid IS DISTINCT FROM total OR paid_at IS NULL);
    v_order_ledger_healed := FOUND;
  ELSIF v_prev_payment_status = 'refunded' THEN
    v_order_skipped_status := v_prev_payment_status;
  ELSE
    UPDATE public.orders
       SET payment_status = 'paid',
           amount_paid = total,
           paid_at = COALESCE(paid_at, v_gateway_paid_at),
           shipping_status = CASE
             WHEN shipping_status = 'pending' THEN 'processing'
             ELSE shipping_status
           END,
           updated_at = now()
     WHERE id = p_order_id;
    v_order_updated := true;
  END IF;

  IF v_order_updated THEN
    INSERT INTO public.payment_side_effects (
      order_id, transaction_id, step, status, claimed_by, error, result
    ) VALUES (
      p_order_id, p_transaction_id, 'merchant_settlement', 'failed', p_actor,
      'rpc_seed_pending_drain', jsonb_build_object('reason', 'seeded_at_completion')
    )
    ON CONFLICT (order_id, step) DO NOTHING;
  END IF;

  SELECT payment_status, shipping_status, cancelled_at
    INTO v_post_payment_status, v_post_shipping_status, v_post_cancelled_at
    FROM public.orders
   WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'already_completed', v_already_completed,
    'order_already_paid', v_order_already_paid,
    'order_updated', v_order_updated,
    'order_ledger_healed', v_order_ledger_healed,
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

REVOKE ALL ON FUNCTION public.complete_order_gateway_payment(uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_order_gateway_payment(uuid, uuid, jsonb, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.claim_payment_side_effect(
  p_order_id uuid,
  p_transaction_id uuid,
  p_step text,
  p_claim_token uuid,
  p_claimed_by text
) RETURNS TABLE (we_won boolean, current_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: claim_payment_side_effect requires service_role';
  END IF;

  INSERT INTO public.payment_side_effects
    (order_id, transaction_id, step, status, claim_token, claimed_by)
  VALUES
    (p_order_id, p_transaction_id, p_step, 'claimed', p_claim_token, p_claimed_by)
  ON CONFLICT (order_id, step) DO UPDATE
    SET claim_token = EXCLUDED.claim_token,
        claimed_by = EXCLUDED.claimed_by,
        claimed_at = now(),
        status = 'claimed',
        attempts = public.payment_side_effects.attempts + 1
    WHERE public.payment_side_effects.attempts < 5
      AND (
        (
          public.payment_side_effects.status = 'failed'
          AND public.payment_side_effects.claimed_at <= now() - LEAST(
            interval '4 hours',
            interval '15 minutes' * power(2, public.payment_side_effects.attempts - 1)
          )
        )
        OR (
          public.payment_side_effects.status = 'claimed'
          AND public.payment_side_effects.claimed_at < now() - interval '60 seconds'
        )
      );

  RETURN QUERY
  SELECT pse.claim_token = p_claim_token, pse.status
    FROM public.payment_side_effects pse
   WHERE pse.order_id = p_order_id AND pse.step = p_step;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_payment_side_effect(uuid, uuid, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_payment_side_effect(uuid, uuid, text, uuid, text)
  TO service_role;
