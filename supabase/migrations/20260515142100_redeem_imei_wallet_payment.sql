CREATE OR REPLACE FUNCTION public.redeem_imei_wallet_payment(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_amount numeric,
  p_lookup_id uuid,
  p_description text DEFAULT NULL::text
) RETURNS TABLE(
  success boolean,
  new_balance numeric,
  transaction_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_wallet_id uuid;
  v_current_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
  v_existing_tx uuid;
  v_existing_balance_after numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'redeem_imei_wallet_payment p_amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  IF p_lookup_id IS NULL THEN
    RAISE EXCEPTION 'redeem_imei_wallet_payment p_lookup_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'redeem_imei_wallet_payment p_customer_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'redeem_imei_wallet_payment p_merchant_id is required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    ('x' || substr(md5(p_lookup_id::text), 1, 16))::bit(64)::bigint
  );

  SELECT id, balance_after INTO v_existing_tx, v_existing_balance_after
  FROM public.customer_wallet_transactions
  WHERE
    source_type = 'imei_wallet_payment'
    AND source_id = p_lookup_id
    AND customer_id = p_customer_id
    AND merchant_id = p_merchant_id
    AND type = 'redemption'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_tx IS NOT NULL THEN
    RETURN QUERY SELECT true, v_existing_balance_after, v_existing_tx;
    RETURN;
  END IF;

  SELECT id, available_balance INTO v_wallet_id, v_current_balance
  FROM public.customer_wallets
  WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_wallet_id IS NULL OR v_current_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_wallet_balance'
      USING ERRCODE = 'P0001';
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE public.customer_wallets
  SET
    available_balance = v_new_balance,
    total_redeemed = total_redeemed + p_amount,
    updated_at = now()
  WHERE id = v_wallet_id;

  INSERT INTO public.customer_wallet_transactions (
    wallet_id,
    customer_id,
    merchant_id,
    type,
    amount,
    balance_after,
    source_type,
    source_id,
    description
  )
  VALUES (
    v_wallet_id,
    p_customer_id,
    p_merchant_id,
    'redemption',
    p_amount,
    v_new_balance,
    'imei_wallet_payment',
    p_lookup_id,
    COALESCE(p_description, 'IMEI wallet payment: ' || p_lookup_id::text)
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_imei_wallet_payment(uuid, uuid, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_imei_wallet_payment(uuid, uuid, numeric, uuid, text) TO service_role;
