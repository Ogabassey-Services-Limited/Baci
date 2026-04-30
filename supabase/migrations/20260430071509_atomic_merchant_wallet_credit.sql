-- Use a single atomic wallet upsert for merchant wallet credits and add the
-- lookup index used by customer wallet credit idempotency checks.

CREATE INDEX IF NOT EXISTS idx_customer_wallet_transactions_idempotency
  ON public.customer_wallet_transactions (
    customer_id,
    merchant_id,
    source_type,
    source_id,
    type
  );

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_merchant_idempotency
  ON public.wallet_transactions (
    merchant_id,
    source_type,
    source_id,
    type
  );

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.merchants m
    WHERE m.id = p_merchant_id
  ) THEN
    RAISE EXCEPTION 'Merchant does not exist'
      USING ERRCODE = '23503';
  END IF;

  -- Source-less merchant credits are intentionally non-idempotent because
  -- callers without a source id do not provide a stable business key.
  IF p_source_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'merchant_wallet:' || p_merchant_id::text || ':' ||
          COALESCE(p_source_type, '<null-source-type>') || ':' ||
          p_source_id::text,
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
      AND wt.source_type IS NOT DISTINCT FROM p_source_type
      AND wt.source_id = p_source_id
      AND wt.type = 'credit'
    ORDER BY wt.created_at DESC
    LIMIT 1;

    IF v_transaction_id IS NOT NULL THEN
      RETURN QUERY SELECT v_wallet_id, v_new_balance, v_transaction_id;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.merchant_wallets (
    merchant_id,
    available_balance,
    pending_balance,
    total_earned
  )
  VALUES (
    p_merchant_id,
    p_amount,
    0,
    p_amount
  )
  ON CONFLICT (merchant_id) DO UPDATE SET
    available_balance =
      public.merchant_wallets.available_balance + EXCLUDED.available_balance,
    total_earned = public.merchant_wallets.total_earned + EXCLUDED.total_earned,
    updated_at = now()
  RETURNING id, available_balance INTO v_wallet_id, v_new_balance;

  IF NOT FOUND OR v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Unable to credit merchant wallet for merchant %', p_merchant_id
      USING ERRCODE = 'P0002';
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
    COALESCE(
      p_description,
      pg_catalog.initcap(
        pg_catalog.replace(
          COALESCE(NULLIF(pg_catalog.btrim(p_source_type), ''), 'wallet'),
          '_',
          ' '
        )
      ) || ' Commission'
    ),
    'completed'
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT v_wallet_id, v_new_balance, v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_merchant_wallet(uuid, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_merchant_wallet(uuid, numeric, text, uuid, text) TO service_role;
