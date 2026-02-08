-- Secure RPC for inserting order-linked transactions without service role

CREATE OR REPLACE FUNCTION public.create_order_transaction(
  p_order_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_status TEXT,
  p_gateway TEXT,
  p_reference TEXT,
  p_transaction_type TEXT,
  p_description TEXT,
  p_metadata JSONB,
  p_platform_fee NUMERIC DEFAULT 0,
  p_merchant_amount NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_merchant_id UUID;
  v_order_merchant_id UUID;
  v_tx_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id INTO v_merchant_id
  FROM merchants
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_merchant_id IS NULL THEN
    SELECT merchant_id INTO v_merchant_id
    FROM staff_members
    WHERE user_id = v_user_id AND status = 'active'
    LIMIT 1;
  END IF;

  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'Merchant not found';
  END IF;

  SELECT merchant_id INTO v_order_merchant_id
  FROM orders
  WHERE id = p_order_id
  LIMIT 1;

  IF v_order_merchant_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_merchant_id <> v_merchant_id THEN
    RAISE EXCEPTION 'Merchant mismatch';
  END IF;

  IF p_reference IS NULL OR trim(p_reference) = '' THEN
    RAISE EXCEPTION 'reference_required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_invalid';
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
  )
  VALUES (
    v_merchant_id,
    p_order_id,
    p_transaction_type,
    p_amount,
    COALESCE(p_currency, 'NGN'),
    COALESCE(p_status, 'pending'),
    p_gateway,
    p_reference,
    COALESCE(p_platform_fee, 0),
    p_merchant_amount,
    p_description,
    p_metadata
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_transaction(
  UUID,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  NUMERIC,
  NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_transaction(
  UUID,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  NUMERIC,
  NUMERIC
) TO authenticated;
