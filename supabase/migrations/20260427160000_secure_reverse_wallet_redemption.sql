-- Add optional merchant ownership check to reverse_wallet_redemption.
--
-- The previous version derived the merchant_id from the original redemption
-- transaction without verifying it against a caller-provided merchant id.
-- Service-role callers can now pass `p_merchant_id` and the RPC will refuse to
-- reverse a redemption that belongs to a different merchant. The parameter
-- defaults to NULL so existing callers continue to work unchanged.

CREATE OR REPLACE FUNCTION public.reverse_wallet_redemption(
  p_order_id uuid,
  p_reason text DEFAULT 'Order cancelled'::text,
  p_merchant_id uuid DEFAULT NULL
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
    -- new_balance is NULL (not 0) so callers can distinguish "wallet has 0"
    -- from "no original redemption tx for this order".
    RETURN QUERY SELECT false, 0::numeric, NULL::numeric, NULL::uuid;
    RETURN;
  END IF;

  -- When the caller supplies an expected merchant id, refuse to reverse a
  -- redemption that belongs to a different merchant. This is a defense in
  -- depth check on top of RLS so a service-role caller cannot accidentally
  -- (or maliciously) reverse another merchant's redemption by guessing an
  -- order id. `IS DISTINCT FROM` is NULL-safe, so a NULL merchant_id on the
  -- original tx still triggers the exception when an explicit p_merchant_id
  -- was passed.
  IF p_merchant_id IS NOT NULL
    AND v_original_tx.merchant_id IS DISTINCT FROM p_merchant_id THEN
    RAISE EXCEPTION 'Merchant mismatch on wallet reversal'
      USING ERRCODE = '42501';
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

-- Adding the `p_merchant_id` parameter changes the signature, so the new
-- overload is registered separately. Drop the prior signature so we don't
-- leave behind an unauthenticated overload that bypasses the new check.
DROP FUNCTION IF EXISTS public.reverse_wallet_redemption(uuid, text);

REVOKE ALL ON FUNCTION public.reverse_wallet_redemption(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_wallet_redemption(uuid, text, uuid) TO service_role;
