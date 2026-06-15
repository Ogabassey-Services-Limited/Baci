-- Migration: Wallet payment finalization RPC
-- Created: 2026-02-06
-- Description: Mark wallet-paid orders as paid and create transaction safely

CREATE OR REPLACE FUNCTION public.finalize_wallet_order_payment(
  p_order_id UUID,
  p_amount NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order_id UUID;
  v_order_customer_id UUID;
  v_order_merchant_id UUID;
  v_order_number TEXT;
  v_customer_email TEXT;
  v_customer_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_invalid';
  END IF;

  SELECT
    o.id,
    o.customer_id,
    o.merchant_id,
    o.order_number,
    o.customer_email,
    o.customer_name
  INTO
    v_order_id,
    v_order_customer_id,
    v_order_merchant_id,
    v_order_number,
    v_customer_email,
    v_customer_name
  FROM orders o
  WHERE o.id = p_order_id
  LIMIT 1;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM customers
    WHERE id = v_order_customer_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM transactions
    WHERE order_id = p_order_id
      AND gateway = 'wallet'
      AND status = 'completed'
  ) THEN
    RETURN TRUE;
  END IF;

  UPDATE orders
  SET payment_status = 'paid',
      payment_method = 'wallet'
  WHERE id = p_order_id;

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
    v_order_merchant_id,
    p_order_id,
    'payment',
    p_amount,
    'NGN',
    'completed',
    'wallet',
    'WALLET-' || upper(substr(p_order_id::text, 1, 8)),
    0,
    p_amount,
    'Wallet payment for order ' || COALESCE(v_order_number, p_order_id::text),
    jsonb_build_object(
      'customer_email', v_customer_email,
      'customer_name', v_customer_name,
      'wallet_credit_used', p_amount
    )
  );

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_wallet_order_payment(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_wallet_order_payment(UUID, NUMERIC) TO authenticated;
