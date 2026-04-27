-- Align customer wallet RPC ledger entries with customer_wallet_transactions.type.
-- The table allows: cashback, redemption, bonus, adjustment, expiry.

CREATE OR REPLACE FUNCTION public.credit_customer_wallet(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_amount numeric,
  p_source_type text,
  p_source_id uuid,
  p_description text DEFAULT NULL::text
) RETURNS TABLE(success boolean, new_balance numeric, transaction_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_wallet_id uuid;
  v_new_balance numeric;
  v_transaction_id uuid;
  v_transaction_type text;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'credit_customer_wallet amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = p_customer_id AND c.merchant_id = p_merchant_id
  ) THEN
    RAISE EXCEPTION 'Customer does not belong to merchant'
      USING ERRCODE = '42501';
  END IF;

  v_transaction_type := CASE
    WHEN p_source_type = 'vtu_transaction' THEN 'cashback'
    ELSE 'bonus'
  END;

  INSERT INTO public.customer_wallets (
    customer_id,
    merchant_id,
    available_balance,
    total_earned
  )
  VALUES (p_customer_id, p_merchant_id, p_amount, p_amount)
  -- customer_wallets has a unique customer_id constraint; customers are already merchant-scoped.
  ON CONFLICT (customer_id) DO UPDATE SET
    available_balance =
      public.customer_wallets.available_balance + EXCLUDED.available_balance,
    total_earned = public.customer_wallets.total_earned + EXCLUDED.total_earned,
    updated_at = now()
  RETURNING id, available_balance INTO v_wallet_id, v_new_balance;

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
    v_transaction_type,
    p_amount,
    v_new_balance,
    p_source_type,
    p_source_id,
    COALESCE(p_description, 'Wallet credit')
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_customer_wallet(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_amount numeric,
  p_source_type text,
  p_source_id uuid,
  p_description text DEFAULT NULL::text
) RETURNS TABLE(success boolean, new_balance numeric, transaction_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_wallet_id uuid;
  v_current_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    -- Debit/redemption RPCs return false for invalid requests so checkout callers can continue safely.
    RETURN QUERY SELECT false, 0::numeric, NULL::uuid;
    RETURN;
  END IF;

  SELECT id, available_balance INTO v_wallet_id, v_current_balance
  FROM public.customer_wallets
  WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN QUERY SELECT false, 0::numeric, NULL::uuid;
    RETURN;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT false, v_current_balance, NULL::uuid;
    RETURN;
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
    p_source_type,
    p_source_id,
    COALESCE(p_description, 'Wallet redemption')
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_wallet_for_order(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_order_id uuid,
  p_amount numeric,
  p_order_reference text DEFAULT NULL::text
) RETURNS TABLE(
  success boolean,
  redeemed_amount numeric,
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
  v_redeem_amount numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
  v_existing_tx uuid;
BEGIN
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric, NULL::uuid;
    RETURN;
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'redeem_wallet_for_order p_order_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF auth.role() <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required to redeem wallet'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE
        c.id = p_customer_id
        AND c.merchant_id = p_merchant_id
        AND c.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Not authorized to redeem this wallet'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    ('x' || substr(md5(p_order_id::text), 1, 16))::bit(64)::bigint
  );

  SELECT id INTO v_existing_tx
  FROM public.customer_wallet_transactions
  WHERE
    source_type = 'order_redemption'
    AND source_id = p_order_id
    AND customer_id = p_customer_id
    AND merchant_id = p_merchant_id
  LIMIT 1;

  IF v_existing_tx IS NOT NULL THEN
    RETURN QUERY
    SELECT true, t.amount, t.balance_after, t.id
    FROM public.customer_wallet_transactions t
    WHERE t.id = v_existing_tx;
    RETURN;
  END IF;

  SELECT id, available_balance INTO v_wallet_id, v_current_balance
  FROM public.customer_wallets
  WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_wallet_id IS NULL OR v_current_balance <= 0 THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric, NULL::uuid;
    RETURN;
  END IF;

  v_redeem_amount := LEAST(v_current_balance, p_amount);
  v_new_balance := v_current_balance - v_redeem_amount;

  UPDATE public.customer_wallets
  SET
    available_balance = v_new_balance,
    total_redeemed = total_redeemed + v_redeem_amount,
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
    v_redeem_amount,
    v_new_balance,
    'order_redemption',
    p_order_id,
    'Order payment: ' || COALESCE(p_order_reference, p_order_id::text)
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_redeem_amount, v_new_balance, v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_wallet_redemption(
  p_order_id uuid,
  p_reason text DEFAULT 'Order cancelled'::text
) RETURNS TABLE(
  success boolean,
  reversed_amount numeric,
  new_balance numeric,
  reversal_transaction_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_original_tx record;
  v_new_balance numeric;
  v_reversal_tx_id uuid;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'reverse_wallet_redemption p_order_id is required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    ('x' || substr(md5(p_order_id::text), 1, 16))::bit(64)::bigint
  );

  SELECT t.*, w.available_balance AS current_balance
  INTO v_original_tx
  FROM public.customer_wallet_transactions t
  JOIN public.customer_wallets w ON w.id = t.wallet_id
  WHERE
    t.source_type = 'order_redemption'
    AND t.source_id = p_order_id
    AND t.type = 'redemption'
  FOR UPDATE OF w;

  IF v_original_tx IS NULL THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric, NULL::uuid;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.customer_wallet_transactions
    WHERE source_type = 'order_reversal' AND source_id = p_order_id
  ) THEN
    RETURN QUERY SELECT false, 0::numeric, v_original_tx.current_balance, NULL::uuid;
    RETURN;
  END IF;

  v_new_balance := v_original_tx.current_balance + v_original_tx.amount;

  UPDATE public.customer_wallets
  SET
    available_balance = v_new_balance,
    total_redeemed = GREATEST(total_redeemed - v_original_tx.amount, 0),
    updated_at = now()
  WHERE id = v_original_tx.wallet_id;

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
    v_original_tx.wallet_id,
    v_original_tx.customer_id,
    v_original_tx.merchant_id,
    'adjustment',
    v_original_tx.amount,
    v_new_balance,
    'order_reversal',
    p_order_id,
    p_reason
  )
  RETURNING id INTO v_reversal_tx_id;

  RETURN QUERY SELECT true, v_original_tx.amount, v_new_balance, v_reversal_tx_id;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_customer_wallet(uuid, uuid, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_customer_wallet(uuid, uuid, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_wallet_for_order(uuid, uuid, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_wallet_redemption(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.credit_customer_wallet(uuid, uuid, numeric, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_customer_wallet(uuid, uuid, numeric, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_wallet_for_order(uuid, uuid, uuid, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_wallet_redemption(uuid, text) TO service_role;
