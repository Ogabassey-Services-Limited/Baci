-- Replace `redeem_wallet_for_order` so an invalid (non-positive) amount raises
-- an explicit exception rather than silently returning a "no-op" success.
--
-- The previous version returned `(false, 0, 0, NULL)` when `p_amount <= 0`,
-- which masked programming errors at the call site. Aligning this with
-- `credit_customer_wallet` (which RAISEs with `22023`) makes invalid input
-- visible in logs and easier to detect in tests. The single TS caller in
-- `apps/web/src/app/api/orders/route.ts` already wraps this RPC in a
-- try/catch and gates the call on `wallet_amount > 0`, so the new behavior
-- does not surface to end users.

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
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'redeem_wallet_for_order p_amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'redeem_wallet_for_order p_order_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' THEN
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

REVOKE ALL ON FUNCTION public.redeem_wallet_for_order(uuid, uuid, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_wallet_for_order(uuid, uuid, uuid, numeric, text) TO authenticated, service_role;
