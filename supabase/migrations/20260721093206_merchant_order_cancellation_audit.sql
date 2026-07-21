CREATE TABLE IF NOT EXISTS public.order_cancellation_side_effects (
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  step text NOT NULL CHECK (step IN ('refund', 'customer_email')),
  status text NOT NULL CHECK (status IN (
    'claimed', 'completed', 'failed', 'delivery_uncertain'
  )),
  claim_token uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  attempts integer NOT NULL DEFAULT 1,
  result jsonb,
  error text,
  PRIMARY KEY (order_id, step)
);

CREATE INDEX IF NOT EXISTS order_cancellation_side_effects_open_idx
  ON public.order_cancellation_side_effects (status, claimed_at)
  WHERE status NOT IN ('completed', 'delivery_uncertain');

CREATE INDEX IF NOT EXISTS order_cancellation_side_effects_merchant_id_idx
  ON public.order_cancellation_side_effects (merchant_id);

ALTER TABLE public.order_cancellation_side_effects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_cancellation_side_effects
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.order_cancellation_side_effects TO service_role;

DROP POLICY IF EXISTS service_role_all
  ON public.order_cancellation_side_effects;
CREATE POLICY service_role_all
  ON public.order_cancellation_side_effects
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.cancel_order_as_merchant(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_order public.orders%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'reason_too_long' USING ERRCODE = '22001';
  END IF;

  SELECT o.* INTO v_order
    FROM public.orders o
   WHERE o.id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.merchants m
       WHERE m.id = v_order.merchant_id AND m.user_id = v_actor
    )
    OR public.check_staff_permission(
      v_actor,
      v_order.merchant_id,
      'orders',
      'edit'
    )
  ) THEN
    RAISE EXCEPTION 'order_cancel_forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_order.shipping_status IN ('cancelled', 'canceled')
     OR v_order.cancelled_at IS NOT NULL THEN
    RETURN false;
  END IF;
  IF v_order.shipping_status IN ('shipped', 'delivered', 'completed', 'returned') THEN
    RAISE EXCEPTION 'order_not_cancellable' USING ERRCODE = 'P0001';
  END IF;
  IF v_order.payment_status = 'paid'
     AND v_order.amount_paid IS DISTINCT FROM v_order.total THEN
    RAISE EXCEPTION 'paid_order_ledger_inconsistent' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders
     SET shipping_status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = v_reason,
         cancelled_by = 'merchant',
         updated_at = now()
   WHERE id = p_order_id;

  UPDATE public.order_payment_accounts
     SET expires_at = now()
   WHERE order_id = p_order_id
     AND (expires_at IS NULL OR expires_at > now());

  UPDATE public.order_wallet_funding_intents
     SET status = 'cancelled', updated_at = now()
   WHERE order_id = p_order_id
     AND status NOT IN ('completed', 'cancelled', 'expired', 'failed');

  -- Quantity inventory is restored only for manage_stock=true products;
  -- unlimited-inventory products are deliberately untouched by this helper.
  PERFORM private.restock_order_items(p_order_id);
  PERFORM private.release_order_inventory_units(
    v_order.merchant_id,
    p_order_id,
    'available'
  );

  INSERT INTO public.order_audit_events (
    merchant_id,
    order_id,
    actor_user_id,
    action,
    change_category,
    changed_fields,
    before_snapshot,
    after_snapshot,
    metadata
  ) VALUES (
    v_order.merchant_id,
    p_order_id,
    v_actor,
    'order.update',
    'customer_visible',
    ARRAY['shipping_status', 'cancelled_at', 'cancellation_reason', 'cancelled_by'],
    jsonb_build_object(
      'shipping_status', v_order.shipping_status,
      'cancelled_at', v_order.cancelled_at,
      'cancellation_reason', v_order.cancellation_reason,
      'cancelled_by', v_order.cancelled_by
    ),
    jsonb_build_object(
      'shipping_status', 'cancelled',
      'cancelled_at', now(),
      'cancellation_reason', v_reason,
      'cancelled_by', 'merchant'
    ),
    jsonb_build_object('operation', 'merchant_order_cancellation')
  );

  INSERT INTO public.order_cancellation_side_effects (
    order_id, merchant_id, step, status, claim_token
  ) VALUES (
    p_order_id, v_order.merchant_id, 'customer_email', 'failed',
    extensions.gen_random_uuid()
  ) ON CONFLICT (order_id, step) DO NOTHING;

  IF v_order.payment_status = 'paid' AND v_order.amount_paid > 0 THEN
    INSERT INTO public.order_cancellation_side_effects (
      order_id, merchant_id, step, status, claim_token
    ) VALUES (
      p_order_id, v_order.merchant_id, 'refund', 'failed',
      extensions.gen_random_uuid()
    ) ON CONFLICT (order_id, step) DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_order_as_merchant(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.cancel_order_as_merchant(uuid, text)
  TO authenticated;

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
  v_actor uuid := (SELECT auth.uid());
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_step NOT IN ('refund', 'customer_email') OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'invalid_cancellation_side_effect';
  END IF;

  SELECT o.* INTO v_order
    FROM public.orders o
   WHERE o.id = p_order_id
     AND (
       o.shipping_status IN ('cancelled', 'canceled')
       OR o.cancelled_at IS NOT NULL
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cancelled_order_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.merchants m
       WHERE m.id = v_order.merchant_id AND m.user_id = v_actor
    )
    OR public.check_staff_permission(
      v_actor, v_order.merchant_id, 'orders', 'edit'
    )
  ) THEN
    RAISE EXCEPTION 'order_cancel_forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_step = 'refund'
     AND (v_order.payment_status <> 'paid' OR v_order.amount_paid <= 0) THEN
    RAISE EXCEPTION 'refund_not_required';
  END IF;

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
    WHERE side_effect.status = 'failed'
       OR (
         side_effect.status = 'claimed'
         AND side_effect.claimed_at < now() - interval '5 minutes'
       );
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
  v_actor uuid := (SELECT auth.uid());
  v_updated boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
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
     AND EXISTS (
       SELECT 1
         FROM public.orders o
        WHERE o.id = side_effect.order_id
          AND (
            EXISTS (
              SELECT 1 FROM public.merchants m
               WHERE m.id = o.merchant_id AND m.user_id = v_actor
            )
            OR public.check_staff_permission(
              v_actor, o.merchant_id, 'orders', 'edit'
            )
          )
     )
  RETURNING true INTO v_updated;

  RETURN COALESCE(v_updated, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_cancellation_side_effect(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.claim_order_cancellation_side_effect(uuid, text, uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.finish_order_cancellation_side_effect(
  uuid, text, uuid, text, jsonb, text
) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.finish_order_cancellation_side_effect(
  uuid, text, uuid, text, jsonb, text
) TO authenticated;
