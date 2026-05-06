-- Strict-amount wallet debit for VTU purchases.
--
-- Modeled on `redeem_wallet_for_order`
-- (20260427160500_redeem_wallet_for_order_raise_on_invalid_amount.sql:12-142)
-- but with two critical differences:
--
-- 1. STRICT AMOUNT — no capping. The order flow uses
--    `LEAST(available_balance, p_amount)` because gateway charging happens
--    AFTER the redemption and can adjust to whatever was redeemed. The
--    VTU flow charges the gateway FIRST for the residual based on the
--    walletAmount the customer committed to at initialize time. By the
--    time fulfillPendingVtuTransaction runs the wallet debit, the card
--    has already been charged; a short-debit would leave the customer
--    paying less than the bill amount with no way to make up the
--    difference inside the same vend. Raise instead.
--
-- 2. EXPLICIT ERROR CONTRACT — `RAISE EXCEPTION USING ERRCODE = 'P0001',
--    MESSAGE = 'insufficient_wallet_balance'`. Callers in
--    apps/web/src/lib/vtu-fulfillment.ts MUST match on the exact MESSAGE
--    string (constant `INSUFFICIENT_WALLET_BALANCE_MESSAGE`); ERRCODE
--    `'P0001'` is the default for plpgsql RAISE without USING ERRCODE
--    and is therefore not unique. Code matching alone is insufficient.
--    The constant lives at:
--      apps/web/src/lib/vtu-fulfillment.ts → INSUFFICIENT_WALLET_BALANCE_MESSAGE
--    Update the constant if this MESSAGE ever changes.

CREATE OR REPLACE FUNCTION public.redeem_vtu_wallet_payment(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_amount numeric,
  p_vtu_transaction_id uuid,
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
    RAISE EXCEPTION 'redeem_vtu_wallet_payment p_amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  IF p_vtu_transaction_id IS NULL THEN
    RAISE EXCEPTION 'redeem_vtu_wallet_payment p_vtu_transaction_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'redeem_vtu_wallet_payment p_customer_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'redeem_vtu_wallet_payment p_merchant_id is required'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize concurrent redemptions for the same VTU transaction so we
  -- don't race two simultaneous fulfillment retries into a duplicate
  -- ledger row. Same advisory-lock pattern as redeem_wallet_for_order.
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(md5(p_vtu_transaction_id::text), 1, 16))::bit(64)::bigint
  );

  -- Idempotency: if this VTU transaction was already debited, return the
  -- cached row. Re-running fulfillment is therefore safe.
  SELECT id, balance_after INTO v_existing_tx, v_existing_balance_after
  FROM public.customer_wallet_transactions
  WHERE
    source_type = 'vtu_wallet_payment'
    AND source_id = p_vtu_transaction_id
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

  -- Strict: any shortfall raises 'insufficient_wallet_balance'.
  -- The MESSAGE string is part of the public contract — callers in
  -- vtu-fulfillment.ts match on it (see file header for the constant).
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
    'vtu_wallet_payment',
    p_vtu_transaction_id,
    COALESCE(p_description, 'VTU wallet payment: ' || p_vtu_transaction_id::text)
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_vtu_wallet_payment(uuid, uuid, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_vtu_wallet_payment(uuid, uuid, numeric, uuid, text) TO service_role;
