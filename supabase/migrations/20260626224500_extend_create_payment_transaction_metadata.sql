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
  v_order_merchant_id UUID;
  v_order_total NUMERIC;
  v_order_email TEXT;
  v_existing_id UUID;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF p_reference IS NULL OR trim(p_reference) = '' THEN
    RAISE EXCEPTION 'reference_required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_invalid';
  END IF;

  SELECT o.merchant_id, o.total, o.customer_email
    INTO v_order_merchant_id, v_order_total, v_order_email
  FROM orders o
  WHERE o.id = p_order_id
  LIMIT 1;

  IF v_order_merchant_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_order_merchant_id <> p_merchant_id THEN
    RAISE EXCEPTION 'merchant_mismatch';
  END IF;

  IF lower(trim(v_order_email)) <> lower(trim(p_customer_email)) THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  IF v_order_total IS NOT NULL AND p_amount > v_order_total THEN
    RAISE EXCEPTION 'amount_exceeds_total';
  END IF;

  -- Idempotency: return existing transaction if reference already used.
  SELECT t.id INTO v_existing_id
  FROM transactions t
  WHERE t.gateway_reference = p_reference
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO transactions (
    merchant_id, order_id, transaction_type, amount, currency, status,
    gateway, gateway_reference, platform_fee, merchant_amount, description, metadata
  ) VALUES (
    p_merchant_id, p_order_id, 'payment', p_amount,
    COALESCE(p_currency, 'NGN'), 'pending', p_gateway, p_reference,
    p_platform_fee, p_merchant_amount,
    'Payment for order ' || p_order_id::TEXT,
    jsonb_strip_nulls(
      jsonb_build_object(
        'customer_email', p_customer_email,
        'customer_name', p_customer_name,
        'session_id', p_session_id
      ) || COALESCE(p_metadata, '{}'::jsonb)
    )
  )
  RETURNING transactions.id INTO v_existing_id;

  -- Update order status to pending (skip payment_reference — column doesn't exist).
  UPDATE orders o
  SET
    payment_status = 'pending',
    currency = COALESCE(p_currency, o.currency),
    updated_at = NOW()
  WHERE o.id = p_order_id
    AND o.merchant_id = p_merchant_id;

  RETURN v_existing_id;
END;
$$;

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
) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_payment_transaction(
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
) TO anon;
GRANT ALL ON FUNCTION public.create_payment_transaction(
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
) TO authenticated;
GRANT ALL ON FUNCTION public.create_payment_transaction(
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
) TO service_role;
