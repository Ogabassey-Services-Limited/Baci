DROP FUNCTION IF EXISTS public.create_payment_transaction(
  uuid,
  uuid,
  numeric,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text
);

CREATE OR REPLACE FUNCTION public.create_payment_transaction(
  p_merchant_id uuid,
  p_order_id uuid,
  p_amount numeric,
  p_currency text,
  p_gateway text,
  p_reference text,
  p_platform_fee numeric,
  p_merchant_amount numeric,
  p_customer_email text,
  p_customer_name text,
  p_session_id text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_merchant_id uuid;
  v_order_total numeric;
  v_order_email text;
  v_existing_id uuid;
  v_existing_order_id uuid;
  v_existing_merchant_id uuid;
  v_gateway text := lower(trim(COALESCE(p_gateway, '')));
  v_order_payment_status text;
  v_reference text := trim(COALESCE(p_reference, ''));
  v_request_role text := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), ''),
    ''
  );
  v_request_user_id uuid := auth.uid();
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF v_reference = '' THEN
    RAISE EXCEPTION 'reference_required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_invalid';
  END IF;

  SELECT o.merchant_id, o.total, o.customer_email
    INTO v_order_merchant_id, v_order_total, v_order_email
  FROM public.orders o
  WHERE o.id = p_order_id
  LIMIT 1;

  IF v_order_merchant_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_order_merchant_id <> p_merchant_id THEN
    RAISE EXCEPTION 'merchant_mismatch';
  END IF;

  IF v_request_role <> 'service_role' THEN
    IF v_request_user_id IS NULL THEN
      RAISE EXCEPTION 'authenticated_user_required';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.merchants m
      WHERE m.id = p_merchant_id
        AND m.user_id = v_request_user_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.staff_members sm
      WHERE sm.merchant_id = p_merchant_id
        AND sm.user_id = v_request_user_id
        AND sm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'unauthorized_merchant';
    END IF;
  END IF;

  IF lower(trim(v_order_email)) <> lower(trim(p_customer_email)) THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  IF v_order_total IS NOT NULL AND p_amount > v_order_total THEN
    RAISE EXCEPTION 'amount_exceeds_total';
  END IF;

  v_order_payment_status := CASE
    WHEN v_gateway IN ('klump', 'credit_direct') THEN 'bnpl_pending'
    ELSE 'pending'
  END;

  -- Idempotency: return existing transaction if reference already used, but
  -- still repair the order status for older BNPL initializations that were
  -- stored as generic pending.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_reference, 0));

  SELECT t.id, t.order_id, t.merchant_id
    INTO v_existing_id, v_existing_order_id, v_existing_merchant_id
  FROM public.transactions t
  WHERE t.gateway_reference = v_reference
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_order_id IS DISTINCT FROM p_order_id
      OR v_existing_merchant_id IS DISTINCT FROM p_merchant_id THEN
      RAISE EXCEPTION 'reference_in_use';
    END IF;

    UPDATE public.orders o
    SET
      payment_status = v_order_payment_status,
      currency = COALESCE(p_currency, o.currency),
      updated_at = now()
    WHERE o.id = p_order_id
      AND o.merchant_id = p_merchant_id
      AND o.payment_status NOT IN (
        'paid',
        'partially_paid',
        'bnpl_approved',
        'refunded',
        'cancelled'
      );

    RETURN v_existing_id;
  END IF;

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
  ) VALUES (
    p_merchant_id,
    p_order_id,
    'payment',
    p_amount,
    COALESCE(p_currency, 'NGN'),
    'pending',
    v_gateway,
    v_reference,
    p_platform_fee,
    p_merchant_amount,
    'Payment for order ' || p_order_id::text,
    jsonb_strip_nulls(
      jsonb_build_object(
        'customer_email', p_customer_email,
        'customer_name', p_customer_name,
        'session_id', p_session_id
      ) || COALESCE(p_metadata, '{}'::jsonb)
    )
  )
  RETURNING transactions.id INTO v_existing_id;

  UPDATE public.orders o
  SET
    payment_status = v_order_payment_status,
    currency = COALESCE(p_currency, o.currency),
    updated_at = now()
  WHERE o.id = p_order_id
    AND o.merchant_id = p_merchant_id
    AND o.payment_status NOT IN (
      'paid',
      'partially_paid',
      'bnpl_approved',
      'refunded',
      'cancelled'
    );

  RETURN v_existing_id;
END;
$$;

COMMENT ON FUNCTION public.create_payment_transaction(
  uuid,
  uuid,
  numeric,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text,
  jsonb
) IS
  'Creates an authorized pending payment transaction with metadata and moves BNPL gateways into bnpl_pending while retaining generic pending for non-BNPL gateways.';

REVOKE ALL ON FUNCTION public.create_payment_transaction(
  uuid,
  uuid,
  numeric,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text,
  jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_transaction(
  uuid,
  uuid,
  numeric,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text,
  jsonb
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_abandoned_orders(hours_threshold int DEFAULT 72)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF hours_threshold IS NULL OR hours_threshold < 1 OR hours_threshold > 720 THEN
    RAISE EXCEPTION 'invalid_hours_threshold: % (expected 1-720)', hours_threshold
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders o
  SET
    payment_status = 'cancelled',
    shipping_status = CASE
      WHEN o.payment_status IN ('pending', 'bnpl_pending')
        AND o.payment_method IN ('credit_direct', 'klump')
      THEN 'cancelled'
      ELSE o.shipping_status
    END,
    cancelled_at = CASE
      WHEN o.payment_status IN ('pending', 'bnpl_pending')
        AND o.payment_method IN ('credit_direct', 'klump')
      THEN COALESCE(o.cancelled_at, now())
      ELSE o.cancelled_at
    END,
    updated_at = now()
  WHERE o.created_at < (now() - (hours_threshold * interval '1 hour'))
    AND (
      o.payment_status = 'unpaid'
      OR (
        o.payment_status IN ('pending', 'bnpl_pending')
        AND o.payment_method IN ('credit_direct', 'klump')
      )
    );
END;
$$;

COMMENT ON FUNCTION public.mark_abandoned_orders(integer) IS
  'Cancels stale unpaid orders and stale active BNPL orders for Credit Direct/Klump.';

REVOKE ALL ON FUNCTION public.mark_abandoned_orders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_abandoned_orders(integer) TO service_role;
