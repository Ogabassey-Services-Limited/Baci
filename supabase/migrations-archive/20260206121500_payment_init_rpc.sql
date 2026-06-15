-- Migration: Payment init RPCs for secure public checkout
-- Created: 2026-02-06
-- Description: Validate order context and create pending transactions without service role usage

CREATE OR REPLACE FUNCTION public.get_order_payment_snapshot(
  p_order_id UUID,
  p_email TEXT
)
RETURNS TABLE (
  merchant_id UUID,
  total NUMERIC,
  currency TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.merchant_id,
    o.total,
    o.currency
  FROM orders o
  WHERE o.id = p_order_id
    AND lower(o.customer_email) = lower(trim(p_email))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_payment_snapshot(UUID, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_payment_transaction(
  p_merchant_id UUID,
  p_order_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_gateway TEXT,
  p_reference TEXT,
  p_platform_fee NUMERIC,
  p_merchant_amount NUMERIC,
  p_customer_email TEXT,
  p_customer_name TEXT,
  p_session_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  SELECT id INTO v_existing_id
  FROM transactions
  WHERE gateway_reference = p_reference
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO transactions (
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
    p_gateway,
    p_reference,
    p_platform_fee,
    p_merchant_amount,
    CASE
      WHEN p_order_id IS NULL THEN 'Payment initialization'
      ELSE 'Payment for order ' || p_order_id::TEXT
    END,
    jsonb_build_object(
      'customer_email', p_customer_email,
      'customer_name', p_customer_name,
      'session_id', p_session_id
    )
  )
  RETURNING id INTO v_existing_id;

  UPDATE orders
  SET
    payment_reference = p_reference,
    payment_status = 'pending',
    currency = COALESCE(p_currency, currency),
    updated_at = NOW()
  WHERE id = p_order_id
    AND merchant_id = p_merchant_id;

  RETURN v_existing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_payment_transaction(
  UUID,
  UUID,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT
) TO anon, authenticated;
