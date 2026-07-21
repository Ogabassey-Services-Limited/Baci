CREATE OR REPLACE FUNCTION public.claim_order_cancellation_side_effect(
  p_order_id uuid,
  p_step text,
  p_claim_token uuid
)
RETURNS TABLE (we_won boolean, current_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order record;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_step NOT IN ('refund', 'customer_email') OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'invalid_cancellation_side_effect';
  END IF;

  SELECT o.merchant_id, o.payment_status, o.amount_paid
  INTO v_order
    FROM public.orders o
   WHERE o.id = p_order_id
     AND (
       o.shipping_status IN ('cancelled', 'canceled')
       OR o.cancelled_at IS NOT NULL
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cancelled_order_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF p_step = 'refund'
     AND (v_order.payment_status <> 'paid' OR v_order.amount_paid <= 0) THEN
    RAISE EXCEPTION 'refund_not_required';
  END IF;

  -- A crashed request may have delivered the external effect before losing
  -- its claim. Never replay that ambiguous provider/email delivery.
  UPDATE public.order_cancellation_side_effects AS side_effect
     SET status = 'delivery_uncertain',
         error = 'Claim expired before completion; delivery requires reconciliation'
   WHERE side_effect.order_id = p_order_id
     AND side_effect.step = p_step
     AND side_effect.status = 'claimed'
     AND side_effect.claimed_at < now() - interval '5 minutes';

  -- A completed local refund transaction is authoritative for retries where
  -- Paystack succeeded but finalizing the claim failed.
  IF p_step = 'refund' AND EXISTS (
    SELECT 1 FROM public.transactions t
     WHERE t.order_id = p_order_id
       AND t.transaction_type = 'refund'
       AND t.status = 'completed'
       AND t.amount = v_order.amount_paid
  ) THEN
    INSERT INTO public.order_cancellation_side_effects AS side_effect (
      order_id, merchant_id, step, status, claim_token, completed_at
    ) VALUES (
      p_order_id, v_order.merchant_id, p_step, 'completed', p_claim_token, now()
    )
    ON CONFLICT (order_id, step) DO UPDATE SET
      status = 'completed', completed_at = COALESCE(side_effect.completed_at, now()),
      error = NULL;
  ELSE
    INSERT INTO public.order_cancellation_side_effects AS side_effect (
      order_id, merchant_id, step, status, claim_token
    ) VALUES (
      p_order_id, v_order.merchant_id, p_step, 'claimed', p_claim_token
    )
    ON CONFLICT (order_id, step) DO UPDATE SET
      status = 'claimed', claim_token = EXCLUDED.claim_token,
      claimed_at = now(), completed_at = NULL, error = NULL,
      attempts = side_effect.attempts + 1
    WHERE side_effect.status = 'failed';
  END IF;

  RETURN QUERY
  SELECT side_effect.claim_token = p_claim_token
           AND side_effect.status = 'claimed',
         side_effect.status
    FROM public.order_cancellation_side_effects side_effect
   WHERE side_effect.order_id = p_order_id
     AND side_effect.step = p_step;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_order_cancellation_side_effect(
  p_order_id uuid,
  p_step text,
  p_claim_token uuid,
  p_status text,
  p_result jsonb DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated boolean := false;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('completed', 'failed', 'delivery_uncertain') THEN
    RAISE EXCEPTION 'invalid_cancellation_side_effect_status';
  END IF;

  UPDATE public.order_cancellation_side_effects AS side_effect
     SET status = p_status,
         completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE NULL END,
         result = p_result,
         error = CASE WHEN p_status = 'completed' THEN NULL ELSE p_error END
   WHERE side_effect.order_id = p_order_id
     AND side_effect.step = p_step
     AND side_effect.claim_token = p_claim_token
     AND side_effect.status = 'claimed'
  RETURNING true INTO v_updated;

  RETURN COALESCE(v_updated, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_cancellation_side_effect(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.claim_order_cancellation_side_effect(uuid, text, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.finish_order_cancellation_side_effect(
  uuid, text, uuid, text, jsonb, text
) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.finish_order_cancellation_side_effect(
  uuid, text, uuid, text, jsonb, text
) TO service_role;
