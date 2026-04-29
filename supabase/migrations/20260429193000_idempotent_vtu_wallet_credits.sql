-- Make VTU wallet credit RPCs idempotent under concurrent confirmation retries.

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

  IF p_source_type = 'vtu_transaction' AND p_source_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'customer_wallet:vtu_transaction:' || p_source_id::text,
        0
      )
    );

    SELECT
      cwt.wallet_id,
      cwt.balance_after,
      cwt.id
    INTO v_wallet_id, v_new_balance, v_transaction_id
    FROM public.customer_wallet_transactions cwt
    WHERE
      cwt.customer_id = p_customer_id
      AND cwt.merchant_id = p_merchant_id
      AND cwt.source_type = p_source_type
      AND cwt.source_id = p_source_id
      AND cwt.type = v_transaction_type
    ORDER BY cwt.created_at DESC
    LIMIT 1;

    IF v_transaction_id IS NOT NULL THEN
      RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.customer_wallets (
    customer_id,
    merchant_id,
    available_balance,
    total_earned
  )
  VALUES (p_customer_id, p_merchant_id, p_amount, p_amount)
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

CREATE OR REPLACE FUNCTION public.credit_merchant_wallet(
  p_merchant_id uuid,
  p_amount numeric,
  p_source_type text,
  p_source_id uuid,
  p_description text DEFAULT NULL::text
) RETURNS TABLE(wallet_id uuid, new_balance numeric, transaction_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_wallet_id uuid;
  v_new_balance numeric;
  v_transaction_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'credit_merchant_wallet amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  IF p_source_type = 'vtu_transaction' AND p_source_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'merchant_wallet:vtu_transaction:' || p_source_id::text,
        0
      )
    );

    SELECT
      wt.wallet_id,
      wt.balance_after,
      wt.id
    INTO v_wallet_id, v_new_balance, v_transaction_id
    FROM public.wallet_transactions wt
    WHERE
      wt.merchant_id = p_merchant_id
      AND wt.source_type = p_source_type
      AND wt.source_id = p_source_id
      AND wt.type = 'credit'
    ORDER BY wt.created_at DESC
    LIMIT 1;

    IF v_transaction_id IS NOT NULL THEN
      RETURN QUERY SELECT v_wallet_id, v_new_balance, v_transaction_id;
      RETURN;
    END IF;
  END IF;

  v_wallet_id := public.get_or_create_merchant_wallet(p_merchant_id);

  UPDATE public.merchant_wallets
  SET
    available_balance = available_balance + p_amount,
    total_earned = total_earned + p_amount,
    updated_at = now()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_balance;

  IF NOT FOUND OR v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Unable to credit merchant wallet % because it was not found', v_wallet_id
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.wallet_transactions (
    wallet_id,
    merchant_id,
    type,
    amount,
    balance_after,
    source_type,
    source_id,
    description,
    status
  )
  VALUES (
    v_wallet_id,
    p_merchant_id,
    'credit',
    p_amount,
    v_new_balance,
    p_source_type,
    p_source_id,
    COALESCE(p_description, 'VTU Commission'),
    'completed'
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT v_wallet_id, v_new_balance, v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_customer_wallet(uuid, uuid, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_customer_wallet(uuid, uuid, numeric, text, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.credit_merchant_wallet(uuid, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_merchant_wallet(uuid, numeric, text, uuid, text) TO service_role;
