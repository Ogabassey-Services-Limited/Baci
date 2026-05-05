-- Customer-wallet refund path for failed VTU vends.
--
-- Today, when a VTU vend (electricity / cable_tv / betting / airtime / data)
-- is rejected by Kuda or the upstream biller, fulfillPendingVtuTransaction
-- marks the row failed and returns. The customer's gateway payment (Paystack)
-- is never automatically returned. This migration adds:
--
--   1. 'refund' to customer_wallet_transactions.type so refunds are
--      distinguishable from cashback / redemption / adjustment in the ledger
--      (the wallet-balance backfill already accounts for 'refund' as a credit).
--   2. refund_customer_wallet_for_vtu() — an RPC that credits the customer
--      wallet for a failed VTU transaction, idempotent on the (vtu_transaction)
--      pair via pg_advisory_xact_lock + a uniqueness lookup, so concurrent or
--      retried fulfillment attempts can't double-refund.

ALTER TABLE public.customer_wallet_transactions
  DROP CONSTRAINT IF EXISTS customer_wallet_transactions_type_check;

ALTER TABLE public.customer_wallet_transactions
  ADD CONSTRAINT customer_wallet_transactions_type_check
  CHECK (
    type = ANY (
      ARRAY[
        'cashback'::text,
        'redemption'::text,
        'bonus'::text,
        'adjustment'::text,
        'expiry'::text,
        'refund'::text
      ]
    )
  );

CREATE OR REPLACE FUNCTION public.refund_customer_wallet_for_vtu(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_amount numeric,
  p_vtu_transaction_id uuid,
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
  v_source_type constant text := 'vtu_transaction_refund';
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'refund_customer_wallet_for_vtu amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  IF p_vtu_transaction_id IS NULL THEN
    RAISE EXCEPTION 'refund_customer_wallet_for_vtu requires a vtu transaction id'
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

  -- Serialize concurrent refunds for the same VTU transaction so we don't
  -- race two simultaneous fulfillment retries into a duplicate ledger row.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'customer_wallet:' || v_source_type || ':' || p_vtu_transaction_id::text,
      0
    )
  );

  -- Idempotency: if this VTU transaction was already refunded (manual replay
  -- of a webhook, retried mobile poll, etc.) return the existing balance
  -- snapshot instead of crediting again.
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
    AND cwt.source_id = p_vtu_transaction_id
    AND cwt.type = 'refund'
  ORDER BY cwt.created_at DESC
  LIMIT 1;

  IF v_transaction_id IS NOT NULL THEN
    RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
    RETURN;
  END IF;

  -- A refund credits available_balance but does NOT add to total_earned —
  -- that ledger column tracks legitimate cashback/bonus history, not
  -- compensation for a failed payment.
  INSERT INTO public.customer_wallets (
    customer_id,
    merchant_id,
    available_balance,
    total_earned
  )
  VALUES (p_customer_id, p_merchant_id, p_amount, 0)
  ON CONFLICT (customer_id) DO UPDATE SET
    available_balance =
      public.customer_wallets.available_balance + EXCLUDED.available_balance,
    updated_at = now()
  RETURNING id, available_balance INTO v_wallet_id, v_new_balance;

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
    p_vtu_transaction_id,
    COALESCE(p_description, 'VTU vend failed — payment refunded to wallet')
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_customer_wallet_for_vtu(uuid, uuid, numeric, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_customer_wallet_for_vtu(uuid, uuid, numeric, uuid, text) TO service_role;
