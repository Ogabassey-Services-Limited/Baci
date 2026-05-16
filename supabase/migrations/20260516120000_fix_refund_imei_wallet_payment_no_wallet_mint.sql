-- Fix: refund_imei_wallet_payment must never CREATE a wallet.
--
-- The prior body used `INSERT INTO customer_wallets ... ON CONFLICT
-- (customer_id) DO UPDATE`. customer_wallets is unique on customer_id only,
-- so when no wallet row exists the INSERT path runs and mints a brand-new
-- wallet whose opening balance IS the refund amount -- money from nothing.
-- A refund must only ever credit a wallet that was previously debited; the
-- redeem path already requires the wallet to pre-exist (raises
-- insufficient_wallet_balance when absent), and the redemption-exists guard
-- below already proves a debit occurred. Replace the upsert with an explicit
-- locked UPDATE that raises if the wallet is missing (an integrity error,
-- not a mint).

CREATE OR REPLACE FUNCTION public.refund_imei_wallet_payment(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_amount numeric,
  p_lookup_id uuid,
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
  v_source_type constant text := 'imei_wallet_refund';
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'refund_imei_wallet_payment amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  IF p_lookup_id IS NULL THEN
    RAISE EXCEPTION 'refund_imei_wallet_payment requires an IMEI lookup id'
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

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'customer_wallet:' || v_source_type || ':' || p_lookup_id::text,
      0
    )
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.imei_lookups l
    JOIN public.customer_wallet_transactions cwt
      ON cwt.source_id = l.id
     AND cwt.source_type = 'imei_wallet_payment'
     AND cwt.customer_id = l.customer_id
     AND cwt.merchant_id = l.merchant_id
     AND cwt.type = 'redemption'
    WHERE l.id = p_lookup_id
      AND l.customer_id = p_customer_id
      AND l.merchant_id = p_merchant_id
  ) THEN
    RAISE EXCEPTION 'no_imei_wallet_payment_to_refund'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    cwt.wallet_id,
    cwt.balance_after,
    cwt.id
  INTO v_wallet_id, v_new_balance, v_transaction_id
  FROM public.customer_wallet_transactions cwt
  WHERE
    cwt.customer_id = p_customer_id
    AND cwt.merchant_id = p_merchant_id
    AND cwt.source_type = v_source_type
    AND cwt.source_id = p_lookup_id
    AND cwt.type = 'refund'
  ORDER BY cwt.created_at DESC
  LIMIT 1;

  IF v_transaction_id IS NOT NULL THEN
    RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
    RETURN;
  END IF;

  -- Credit the EXISTING wallet only. Never create one here: a refund that
  -- creates a wallet would mint its balance from the refund amount. The
  -- redemption-exists guard above guarantees a debit happened, so the wallet
  -- must exist; if it does not, that is an integrity violation -> raise.
  v_wallet_id := NULL;
  v_new_balance := NULL;

  SELECT id INTO v_wallet_id
  FROM public.customer_wallets
  WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'refund_imei_wallet_payment: wallet not found for customer'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.customer_wallets
  SET
    available_balance = available_balance + p_amount,
    total_redeemed = GREATEST(total_redeemed - p_amount, 0),
    updated_at = now()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_balance;

  INSERT INTO public.customer_wallet_transactions (
    wallet_id,
    customer_id,
    merchant_id,
    type,
    status,
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
    'refund',
    'completed',
    p_amount,
    v_new_balance,
    v_source_type,
    p_lookup_id,
    COALESCE(p_description, 'IMEI lookup failed - payment refunded to wallet')
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_imei_wallet_payment(uuid, uuid, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_imei_wallet_payment(uuid, uuid, numeric, uuid, text) TO service_role;
