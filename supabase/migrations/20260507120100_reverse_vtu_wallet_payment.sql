-- Reverse a previously redeemed VTU wallet payment.
--
-- Mirrors `reverse_wallet_redemption`
-- (20260427160000_secure_reverse_wallet_redemption.sql:9-110) but keyed on
-- the VTU transaction id instead of the order id, and on
-- source_type='vtu_wallet_payment' / 'vtu_wallet_reversal' instead of
-- 'order_redemption' / 'order_reversal'.
--
-- Used by the VTU fulfillment pipeline (Phase B.5) when a hybrid
-- wallet+card payment hits a Kuda failure: the wallet portion is reversed
-- via this RPC and the card portion is refunded via
-- `refund_customer_wallet_for_vtu` so the customer's pre-transaction
-- wallet balance is restored AND a credit equal to the card portion is
-- added on top.
--
-- Idempotent on (source_type='vtu_wallet_reversal', source_id, type).
-- Service-role-only: the only caller is server-side fulfillment.

CREATE OR REPLACE FUNCTION public.reverse_vtu_wallet_payment(
  p_vtu_transaction_id uuid,
  p_reason text DEFAULT 'VTU vend failed'::text,
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
  IF p_vtu_transaction_id IS NULL THEN
    RAISE EXCEPTION 'reverse_vtu_wallet_payment p_vtu_transaction_id is required'
      USING ERRCODE = '22023';
  END IF;

  -- Same advisory-lock key as redeem_vtu_wallet_payment so a debit and
  -- its reversal serialize on the same VTU transaction.
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(md5(p_vtu_transaction_id::text), 1, 16))::bit(64)::bigint
  );

  SELECT t.*, w.available_balance AS current_balance
  INTO v_original_tx
  FROM public.customer_wallet_transactions t
  JOIN public.customer_wallets w ON w.id = t.wallet_id
  WHERE
    t.source_type = 'vtu_wallet_payment'
    AND t.source_id = p_vtu_transaction_id
    AND t.type = 'redemption'
  FOR UPDATE OF w;

  IF v_original_tx IS NULL THEN
    -- new_balance is NULL (not 0) so callers can distinguish "no original
    -- debit existed for this VTU transaction" from "wallet has 0".
    RETURN QUERY SELECT false, 0::numeric, NULL::numeric, NULL::uuid;
    RETURN;
  END IF;

  -- Defense-in-depth merchant scoping. When the caller supplies
  -- p_merchant_id, refuse to reverse a debit that belongs to a different
  -- merchant. NULL-safe via IS DISTINCT FROM.
  IF p_merchant_id IS NOT NULL
    AND v_original_tx.merchant_id IS DISTINCT FROM p_merchant_id THEN
    RAISE EXCEPTION 'Merchant mismatch on VTU wallet reversal'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotency: if we've already reversed this debit, return the
  -- current wallet balance and signal "no-op" via reversal_transaction_id
  -- = NULL. Distinguish from "no original debit" via new_balance being
  -- non-NULL (current wallet balance).
  IF EXISTS (
    SELECT 1 FROM public.customer_wallet_transactions
    WHERE source_type = 'vtu_wallet_reversal'
      AND source_id = p_vtu_transaction_id
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
    'vtu_wallet_reversal',
    p_vtu_transaction_id,
    p_reason
  )
  RETURNING id INTO v_reversal_tx_id;

  RETURN QUERY SELECT true, v_original_tx.amount, v_new_balance, v_reversal_tx_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_vtu_wallet_payment(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_vtu_wallet_payment(uuid, text, uuid) TO service_role;
