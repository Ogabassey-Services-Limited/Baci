-- Forward-only repair for environments that already recorded 20260721093207.

ALTER TABLE public.order_cancellation_side_effects
  ALTER COLUMN attempts SET DEFAULT 0;

-- The original seed counted queue insertion as attempt one. Normalize every
-- pre-repair row once so attempts means actual external executions.
UPDATE public.order_cancellation_side_effects
   SET attempts = GREATEST(attempts - 1, 0);

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
    'serialized_inventory_confirmation_failed',
    'merchant_settlement_failed',
    'gateway_payment_wedge_requires_review',
    'credit_direct_confirmation_missing',
    'order_cancellation_refund_requires_review'
  )) NOT VALID;
ALTER TABLE public.reconciliation_review
  VALIDATE CONSTRAINT reconciliation_review_issue_type_check;

CREATE OR REPLACE FUNCTION public.claim_order_cancellation_side_effect(
  p_order_id uuid,
  p_step text,
  p_claim_token uuid
) RETURNS TABLE (we_won boolean, current_status text)
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

  SELECT o.merchant_id
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
  IF p_step = 'refund' AND NOT EXISTS (
    SELECT 1 FROM public.transactions t
     WHERE t.order_id = p_order_id
       AND t.merchant_id = v_order.merchant_id
       AND t.transaction_type = 'payment'
       AND t.status = 'completed'
       AND t.amount > 0
       AND COALESCE(t.gateway, '') NOT IN (
         'wallet', 'savings', 'store_credit', 'cash', 'manual', 'pay_on_delivery'
       )
  ) THEN
    RAISE EXCEPTION 'refund_not_required';
  END IF;

  UPDATE public.order_cancellation_side_effects AS side_effect
     SET status = 'delivery_uncertain',
         error = 'Claim expired before completion; delivery requires reconciliation'
   WHERE side_effect.order_id = p_order_id
     AND side_effect.step = p_step
     AND side_effect.status = 'claimed'
     AND side_effect.claimed_at < now() - interval '5 minutes';

  IF p_step = 'refund' AND NOT EXISTS (
    SELECT 1
      FROM public.transactions payment
     WHERE payment.order_id = p_order_id
       AND payment.merchant_id = v_order.merchant_id
       AND payment.transaction_type = 'payment'
       AND payment.status = 'completed'
       AND payment.amount > 0
       AND COALESCE(payment.gateway, '') NOT IN (
         'wallet', 'savings', 'store_credit', 'cash', 'manual', 'pay_on_delivery'
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.transactions refund
          WHERE refund.order_id = p_order_id
            AND refund.merchant_id = v_order.merchant_id
            AND refund.transaction_type = 'refund'
            AND refund.status = 'completed'
            AND (
              refund.metadata->>'payment_transaction_id' = payment.id::text
              OR (
                refund.metadata->>'payment_transaction_id' IS NULL
                AND refund.gateway = payment.gateway
                AND refund.amount = payment.amount
                AND 1 = (
                  SELECT count(*) FROM public.transactions only_payment
                   WHERE only_payment.order_id = p_order_id
                     AND only_payment.merchant_id = v_order.merchant_id
                     AND only_payment.transaction_type = 'payment'
                     AND only_payment.status = 'completed'
                     AND only_payment.amount > 0
                     AND COALESCE(only_payment.gateway, '') NOT IN (
                       'wallet', 'savings', 'store_credit', 'cash', 'manual',
                       'pay_on_delivery'
                     )
                )
              )
            )
       )
  ) THEN
    INSERT INTO public.order_cancellation_side_effects AS side_effect (
      order_id, merchant_id, step, status, claim_token, completed_at, attempts
    ) VALUES (
      p_order_id, v_order.merchant_id, p_step, 'completed',
      p_claim_token, now(), 0
    )
    ON CONFLICT (order_id, step) DO UPDATE SET
      status = 'completed',
      completed_at = COALESCE(side_effect.completed_at, now()),
      error = NULL;
  ELSE
    INSERT INTO public.order_cancellation_side_effects AS side_effect (
      order_id, merchant_id, step, status, claim_token, attempts
    ) VALUES (
      p_order_id, v_order.merchant_id, p_step, 'claimed', p_claim_token, 1
    )
    ON CONFLICT (order_id, step) DO UPDATE SET
      status = 'claimed', claim_token = EXCLUDED.claim_token,
      claimed_at = now(), completed_at = NULL, error = NULL,
      attempts = side_effect.attempts + 1
    WHERE side_effect.status = 'failed'
      AND side_effect.attempts < 5;
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
) RETURNS boolean
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

REVOKE ALL ON FUNCTION public.claim_order_cancellation_side_effect(
  uuid, text, uuid
) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.claim_order_cancellation_side_effect(
  uuid, text, uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.finish_order_cancellation_side_effect(
  uuid, text, uuid, text, jsonb, text
) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.finish_order_cancellation_side_effect(
  uuid, text, uuid, text, jsonb, text
) TO service_role;
