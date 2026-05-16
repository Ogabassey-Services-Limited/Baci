-- Fix: refund_imei_wallet_payment must never CREATE a wallet, while keeping
-- the amount-validation hardening from 20260516105713.
--
-- Base: 20260516105713_validate_imei_refund_amount.sql (the latest
-- authoritative definition). That migration looks up v_original_amount from
-- the original redemption transaction, rejects mismatched p_amount
-- (imei_refund_amount_mismatch), and CREDITS using the trusted
-- v_original_amount rather than caller-supplied p_amount. ALL of that is
-- preserved here.
--
-- The only change vs 20260516105713: it credited via
-- `INSERT INTO customer_wallets ... ON CONFLICT (customer_id) DO UPDATE`.
-- customer_wallets is unique on customer_id only, so when no wallet row
-- exists the INSERT path mints a brand-new wallet whose opening balance is
-- the refund amount -- money from nothing. A refund must only ever credit a
-- wallet that was previously debited (the redemption that produced
-- v_original_amount proves one existed). Replace the upsert with an
-- explicit locked UPDATE that raises if the wallet is missing (an integrity
-- error, not a mint).

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
  v_original_amount numeric;
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

  -- Resolve the original debited amount from the redemption transaction.
  -- This both proves a debit occurred and is the trusted amount used for
  -- crediting (never the caller-supplied p_amount).
  SELECT cwt.amount
  INTO v_original_amount
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
  ORDER BY cwt.created_at DESC
  LIMIT 1;

  IF v_original_amount IS NULL THEN
    RAISE EXCEPTION 'no_imei_wallet_payment_to_refund'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_amount <> v_original_amount THEN
    RAISE EXCEPTION 'imei_refund_amount_mismatch'
      USING ERRCODE = '22023';
  END IF;

  -- Idempotency: a prior refund for this lookup short-circuits.
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
  -- creates a wallet would mint v_original_amount from nothing. The
  -- redemption that produced v_original_amount proves the wallet existed;
  -- if it is gone, that is an integrity violation -> raise.
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
    available_balance = available_balance + v_original_amount,
    total_redeemed = GREATEST(total_redeemed - v_original_amount, 0),
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
    v_original_amount,
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
