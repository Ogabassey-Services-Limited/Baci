-- Apply non-withdrawable device savings to matching Ogabassey orders.

CREATE OR REPLACE FUNCTION public.redeem_savings_for_order(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_order_id uuid,
  p_goal_id uuid,
  p_amount numeric,
  p_idempotency_key text
) RETURNS TABLE(
  success boolean,
  goal_id uuid,
  redeemed_amount numeric,
  remaining_goal_amount numeric,
  redemption_id uuid,
  goal_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_existing_redemption record;
  v_fingerprint jsonb;
  v_goal record;
  v_new_goal_amount numeric;
  v_new_goal_status text;
  v_redemption_id uuid;
BEGIN
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'redeem_savings_for_order p_customer_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'redeem_savings_for_order p_merchant_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'redeem_savings_for_order p_order_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_goal_id IS NULL THEN
    RAISE EXCEPTION 'redeem_savings_for_order p_goal_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'redeem_savings_for_order p_amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'redeem_savings_for_order p_idempotency_key is required'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'authentication_required'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = p_customer_id
        AND c.merchant_id = p_merchant_id
        AND c.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'not_authorized_for_customer_savings'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'customer_savings_redemption:' || p_order_id::text,
      0
    )
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.customer_id = p_customer_id
      AND o.merchant_id = p_merchant_id
  ) THEN
    RAISE EXCEPTION 'savings_order_not_found'
      USING ERRCODE = 'P0001';
  END IF;

  v_fingerprint := jsonb_build_object(
    'orderId', p_order_id,
    'goalId', p_goal_id,
    'merchantId', p_merchant_id,
    'customerId', p_customer_id,
    'amount', p_amount
  );

  SELECT r.*
  INTO v_existing_redemption
  FROM public.customer_savings_redemptions r
  WHERE r.order_id = p_order_id
  FOR UPDATE;

  IF v_existing_redemption.id IS NOT NULL THEN
    IF v_existing_redemption.goal_id = p_goal_id
      AND v_existing_redemption.amount = p_amount
      AND v_existing_redemption.metadata->'request_fingerprint' = v_fingerprint
    THEN
      SELECT g.current_amount, g.status
      INTO v_new_goal_amount, v_new_goal_status
      FROM public.customer_savings_goals g
      WHERE g.id = p_goal_id;

      RETURN QUERY
      SELECT
        true,
        p_goal_id,
        v_existing_redemption.amount,
        COALESCE(v_new_goal_amount, 0::numeric),
        v_existing_redemption.id,
        COALESCE(v_new_goal_status, 'spent')::text;
      RETURN;
    END IF;

    RAISE EXCEPTION 'conflicting_savings_redemption_for_order'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT g.*
  INTO v_goal
  FROM public.customer_savings_goals g
  WHERE g.id = p_goal_id
    AND g.customer_id = p_customer_id
    AND g.merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_goal.id IS NULL THEN
    RAISE EXCEPTION 'savings_goal_not_found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_goal.status NOT IN ('active', 'paused', 'completed') THEN
    RAISE EXCEPTION 'savings_goal_not_applicable'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(v_goal.current_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'savings_goal_has_no_available_balance'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_amount > v_goal.current_amount THEN
    RAISE EXCEPTION 'savings_amount_exceeds_goal_balance'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.product_id = v_goal.product_id
      AND (
        v_goal.variant_id IS NULL
        OR oi.variant_id = v_goal.variant_id
      )
  ) THEN
    RAISE EXCEPTION 'savings_goal_does_not_match_order'
      USING ERRCODE = 'P0001';
  END IF;

  v_redemption_id := gen_random_uuid();
  v_new_goal_amount := v_goal.current_amount - p_amount;
  v_new_goal_status := CASE
    WHEN v_new_goal_amount <= 0 THEN 'spent'
    WHEN v_goal.status = 'completed' AND v_new_goal_amount < v_goal.target_amount THEN 'paused'
    ELSE v_goal.status
  END;

  INSERT INTO public.customer_savings_redemptions (
    id,
    goal_id,
    merchant_id,
    customer_id,
    order_id,
    amount,
    idempotency_key,
    metadata
  )
  VALUES (
    v_redemption_id,
    p_goal_id,
    p_merchant_id,
    p_customer_id,
    p_order_id,
    p_amount,
    p_idempotency_key,
    jsonb_build_object('request_fingerprint', v_fingerprint)
  );

  UPDATE public.customer_savings_goals
  SET
    current_amount = GREATEST(v_new_goal_amount, 0),
    status = v_new_goal_status,
    spent_at = CASE
      WHEN v_new_goal_status = 'spent' THEN now()
      ELSE spent_at
    END,
    applied_order_id = CASE
      WHEN v_new_goal_status = 'spent' THEN p_order_id
      ELSE applied_order_id
    END,
    updated_at = now()
  WHERE id = p_goal_id;

  INSERT INTO public.customer_savings_events (
    goal_id,
    merchant_id,
    customer_id,
    event_type,
    actor_type,
    metadata
  )
  VALUES (
    p_goal_id,
    p_merchant_id,
    p_customer_id,
    CASE
      WHEN v_goal.status = 'completed'
        AND v_new_goal_status = 'paused'
        THEN 'savings_partially_applied_to_order'
      ELSE 'savings_applied_to_order'
    END,
    'customer',
    jsonb_build_object(
      'amount', p_amount,
      'order_id', p_order_id,
      'redemption_id', v_redemption_id,
      'remaining_goal_amount', GREATEST(v_new_goal_amount, 0)
    )
  );

  RETURN QUERY
  SELECT
    true,
    p_goal_id,
    p_amount,
    GREATEST(v_new_goal_amount, 0),
    v_redemption_id,
    v_new_goal_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_store_credit_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_order record;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'finalize_store_credit_order_payment p_order_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'finalize_store_credit_order_payment p_amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  IF p_payment_method NOT IN ('savings', 'store_credit') THEN
    RAISE EXCEPTION 'invalid_store_credit_payment_method'
      USING ERRCODE = '22023';
  END IF;

  SELECT o.*
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order_not_found'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'unauthorized'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = v_order.customer_id
        AND c.merchant_id = v_order.merchant_id
        AND c.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'unauthorized'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.order_id = p_order_id
      AND t.gateway = p_payment_method
      AND t.status = 'completed'
  ) THEN
    RETURN true;
  END IF;

  UPDATE public.orders
  SET
    payment_status = 'paid',
    payment_method = p_payment_method,
    amount_paid = p_amount,
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.transactions (
    merchant_id,
    order_id,
    transaction_type,
    amount,
    currency,
    status,
    gateway,
    gateway_reference,
    platform_fee,
    merchant_amount,
    description,
    metadata
  )
  VALUES (
    v_order.merchant_id,
    p_order_id,
    'payment',
    p_amount,
    COALESCE(v_order.currency, 'NGN'),
    'completed',
    p_payment_method,
    upper(p_payment_method) || '-' || upper(substr(p_order_id::text, 1, 8)),
    0,
    p_amount,
    'Store credit payment for order ' || COALESCE(v_order.order_number, p_order_id::text),
    jsonb_build_object(
      'store_credit_used', p_amount
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_savings_for_order(uuid, uuid, uuid, uuid, numeric, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_store_credit_order_payment(uuid, numeric, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.redeem_savings_for_order(uuid, uuid, uuid, uuid, numeric, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_store_credit_order_payment(uuid, numeric, text)
  TO authenticated, service_role;
