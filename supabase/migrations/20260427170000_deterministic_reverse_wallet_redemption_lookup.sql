-- Make `reverse_wallet_redemption` deterministic when looking up the original
-- redemption transaction.
--
-- The previous version selected from `customer_wallet_transactions` filtered
-- by (source_type='order_redemption', source_id=p_order_id, type='redemption')
-- without ORDER BY/LIMIT. There should only ever be one such row per order,
-- but that invariant was not enforced at the schema level — so a duplicate
-- would yield nondeterministic behavior under SELECT...INTO.
--
-- This migration:
--   1. Refuses to apply if duplicates already exist in production (operator
--      must reconcile them first).
--   2. Adds a partial UNIQUE INDEX so future inserts cannot create duplicates.
--   3. Updates the SELECT INTO clause inside `reverse_wallet_redemption` to
--      ORDER BY t.id LIMIT 1 for belt-and-suspenders determinism.

-- 1. Pre-flight duplicate check. Raise loudly so the deploy fails fast and the
-- operator can investigate. We do this BEFORE creating the index so the error
-- message names the duplicates rather than the generic unique-violation error.
DO $$
DECLARE
  v_dup_count int;
BEGIN
  SELECT count(*) INTO v_dup_count
  FROM (
    SELECT source_id
    FROM public.customer_wallet_transactions
    WHERE source_type = 'order_redemption' AND type = 'redemption'
    GROUP BY source_id
    HAVING count(*) > 1
  ) duplicates;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot create unique index: % duplicate (source_type, source_id, type) groups exist for order_redemption. Resolve before deploying.',
      v_dup_count;
  END IF;
END;
$$;

-- 2. Partial unique index — only enforced for the order_redemption /
-- redemption combination, since that is the lookup key the RPC uses.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_customer_wallet_transactions_order_redemption
  ON public.customer_wallet_transactions (source_id)
  WHERE source_type = 'order_redemption' AND type = 'redemption';

-- 3. Deterministic SELECT INTO. Body otherwise identical to
-- 20260427160000_secure_reverse_wallet_redemption.sql.
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
  ORDER BY t.id
  LIMIT 1
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

-- 4. Re-grant EXECUTE to service_role only. CREATE OR REPLACE preserves the
-- prior grants in practice, but we re-assert them defensively in case a future
-- migration or ad-hoc DDL changes the default.
REVOKE ALL ON FUNCTION public.reverse_wallet_redemption(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_wallet_redemption(uuid, text, uuid) TO service_role;
