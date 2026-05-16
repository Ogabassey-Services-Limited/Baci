DO $$
DECLARE
  v_duplicate_source_id text;
BEGIN
  SELECT source_id
  INTO v_duplicate_source_id
  FROM public.points_transactions
  WHERE source = 'vtu_airtime_purchase'
    AND source_id IS NOT NULL
  GROUP BY source_id
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Cannot create VTU airtime points idempotency index: duplicate points_transactions source_id % exists for source vtu_airtime_purchase',
      v_duplicate_source_id;
  END IF;

  SELECT source_id
  INTO v_duplicate_source_id
  FROM public.points_transactions
  WHERE source = 'wallet_redemption'
    AND source_id IS NOT NULL
  GROUP BY source_id
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Cannot create wallet redemption idempotency index: duplicate points_transactions source_id % exists for source wallet_redemption',
      v_duplicate_source_id;
  END IF;
END;
$$;

DO $$
DECLARE
  v_duplicate_source_id uuid;
BEGIN
  SELECT source_id
  INTO v_duplicate_source_id
  FROM public.customer_wallet_transactions
  WHERE source_type = 'loyalty_redemption'
    AND source_id IS NOT NULL
  GROUP BY customer_id, merchant_id, source_type, source_id, type
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Cannot create loyalty redemption wallet idempotency index: duplicate customer_wallet_transactions source_id % exists',
      v_duplicate_source_id;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_points_transactions_vtu_airtime_purchase_once
ON public.points_transactions (source, source_id)
WHERE source = 'vtu_airtime_purchase';

CREATE UNIQUE INDEX IF NOT EXISTS idx_points_transactions_wallet_redemption_once
ON public.points_transactions (source, source_id)
WHERE source = 'wallet_redemption';

-- Keep type even though the current redemption path only writes bonus rows.
-- It is defense-in-depth for future wallet ledger transaction classes that
-- may share loyalty_redemption source ids without representing the same row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_wallet_transactions_loyalty_redemption_once
ON public.customer_wallet_transactions (
  customer_id,
  merchant_id,
  source_type,
  source_id,
  type
)
WHERE source_type = 'loyalty_redemption'
  AND source_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.award_vtu_airtime_loyalty_points(
  p_transaction_id uuid,
  p_points integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_tx record;
  v_points integer;
  v_points_transaction_id uuid;
  v_new_customer_points integer;
BEGIN
  IF p_points IS NULL OR p_points <= 0 THEN
    RETURN jsonb_build_object('success', true, 'awarded', false, 'reason', 'no_points');
  END IF;

  SELECT
    id,
    merchant_id,
    customer_id,
    type,
    status,
    amount,
    network_provider,
    customer_cashback
  INTO v_tx
  FROM public.vtu_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'VTU transaction not found');
  END IF;

  IF v_tx.status <> 'successful' THEN
    RETURN jsonb_build_object('success', true, 'awarded', false, 'reason', 'not_successful');
  END IF;

  IF v_tx.type <> 'airtime' THEN
    RETURN jsonb_build_object('success', true, 'awarded', false, 'reason', 'not_airtime');
  END IF;

  IF v_tx.customer_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'awarded', false, 'reason', 'missing_customer');
  END IF;

  IF COALESCE(v_tx.customer_cashback, 0) <= 0 THEN
    RETURN jsonb_build_object('success', true, 'awarded', false, 'reason', 'no_customer_cashback');
  END IF;

  v_points := FLOOR(v_tx.customer_cashback / 3)::integer;
  IF v_points <= 0 THEN
    RETURN jsonb_build_object('success', true, 'awarded', false, 'reason', 'no_points');
  END IF;

  IF p_points IS DISTINCT FROM v_points THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Loyalty point calculation mismatch',
      'expected_points', v_points,
      'received_points', p_points
    );
  END IF;

  INSERT INTO public.points_transactions (
    customer_id,
    merchant_id,
    type,
    points,
    balance_after,
    source,
    source_id,
    description,
    metadata
  ) VALUES (
    v_tx.customer_id,
    v_tx.merchant_id,
    'earn',
    v_points,
    0,
    'vtu_airtime_purchase',
    v_tx.id::text,
    'Points earned from airtime purchase',
    jsonb_build_object(
      'vtuTransactionId', v_tx.id,
      'amount', v_tx.amount,
      'provider', v_tx.network_provider,
      'customerCashback', v_tx.customer_cashback,
      'rule', 'floor(customer_cashback / 3)'
    )
  )
  ON CONFLICT (source, source_id)
  WHERE source = 'vtu_airtime_purchase'
  DO NOTHING
  RETURNING id INTO v_points_transaction_id;

  IF v_points_transaction_id IS NULL THEN
    SELECT COALESCE(loyalty_points, 0)
    INTO v_new_customer_points
    FROM public.customers
    WHERE id = v_tx.customer_id;

    RETURN jsonb_build_object(
      'success', true,
      'awarded', false,
      'reason', 'already_awarded',
      'points_awarded', v_points,
      'new_points_balance', COALESCE(v_new_customer_points, 0)
    );
  END IF;

  UPDATE public.customers
  SET loyalty_points = COALESCE(loyalty_points, 0) + v_points,
      updated_at = now()
  WHERE id = v_tx.customer_id
  RETURNING loyalty_points INTO v_new_customer_points;

  UPDATE public.points_transactions
  SET balance_after = v_new_customer_points
  WHERE id = v_points_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'awarded', true,
    'points_awarded', v_points,
    'new_points_balance', v_new_customer_points,
    'points_transaction_id', v_points_transaction_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_vtu_airtime_loyalty_points(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_vtu_airtime_loyalty_points(uuid, integer) TO service_role;

-- Keep the existing mobile-facing RPC name. This function already exists as
-- SECURITY DEFINER so authenticated mobile clients can redeem without direct
-- table update grants; preserve that shape, pin search_path, revoke anon, and
-- make the business rule authoritative on the server: 1 point is N1 and
-- redemptions happen in 100-point blocks.
-- This bypasses loyalty_settings only for this mobile wallet redemption RPC.
-- Do not remove loyalty_settings globally: storefront/order loyalty flows still
-- use those settings outside this VTU wallet-points path.
-- Keep p_wallet_credit in the signature so the updated mobile RPC payload can
-- keep its existing field, but intentionally ignore it so the client cannot
-- influence wallet value. Older four-argument callers are deliberately not
-- allowed to redeem because they cannot provide a retry idempotency key. The
-- four-argument compatibility overload below returns a structured rejection
-- instead of mutating balances or surfacing a low-level PostgREST error.
DROP FUNCTION IF EXISTS public.redeem_loyalty_points(uuid, uuid, integer, numeric);

CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_points integer,
  p_wallet_credit numeric,
  p_redemption_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_role text;
  v_current_points integer;
  v_customer_merchant_id uuid;
  v_customer_user_id uuid;
  v_new_points integer;
  v_new_balance numeric;
  v_wallet_id uuid;
  v_wallet_transaction_id uuid;
  v_effective_wallet_credit numeric;
  v_redemption_id uuid;
  v_existing_customer_id uuid;
  v_existing_merchant_id uuid;
  v_existing_points_deducted integer;
  v_existing_points_balance integer;
  v_existing_wallet_credit numeric;
  v_existing_wallet_balance numeric;
BEGIN
  v_caller_uid := (SELECT auth.uid());
  v_caller_role := (SELECT auth.role());

  IF p_points IS NULL OR p_points <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid redemption amount');
  END IF;

  v_effective_wallet_credit := p_points::numeric;

  IF p_points < 100 THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Minimum redemption is 100 points'
    );
  END IF;

  IF p_points % 100 <> 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redeem points in 100-point blocks');
  END IF;

  IF v_effective_wallet_credit <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid redemption configuration');
  END IF;

  IF p_redemption_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redemption id is required');
  END IF;

  v_redemption_id := p_redemption_id;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'loyalty_redemption:' || v_redemption_id::text,
      0
    )
  );

  SELECT loyalty_points, merchant_id, user_id
  INTO v_current_points, v_customer_merchant_id, v_customer_user_id
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
  END IF;

  v_current_points := COALESCE(v_current_points, 0);

  IF v_customer_merchant_id IS DISTINCT FROM p_merchant_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer merchant mismatch');
  END IF;

  IF v_caller_role IS DISTINCT FROM 'service_role'
     AND (
       v_caller_uid IS NULL
       OR (
         v_customer_user_id IS DISTINCT FROM v_caller_uid
         AND NOT public.has_merchant_access(p_merchant_id)
       )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT
    pt.customer_id,
    pt.merchant_id,
    ABS(pt.points),
    pt.balance_after,
    cwt.amount,
    cwt.balance_after
  INTO
    v_existing_customer_id,
    v_existing_merchant_id,
    v_existing_points_deducted,
    v_existing_points_balance,
    v_existing_wallet_credit,
    v_existing_wallet_balance
  FROM public.points_transactions pt
  LEFT JOIN public.customer_wallet_transactions cwt
    ON cwt.customer_id = pt.customer_id
   AND cwt.merchant_id = pt.merchant_id
   AND cwt.source_type = 'loyalty_redemption'
   AND cwt.source_id = v_redemption_id
   AND cwt.type = 'bonus'
  WHERE pt.source = 'wallet_redemption'
    AND pt.source_id = v_redemption_id::text
    AND pt.type = 'redeem'
  ORDER BY pt.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_customer_id IS DISTINCT FROM p_customer_id
       OR v_existing_merchant_id IS DISTINCT FROM p_merchant_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Redemption idempotency key was already used'
      );
    END IF;

    IF v_existing_points_deducted IS DISTINCT FROM p_points THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Redemption idempotency key was already used for a different amount'
      );
    END IF;

    IF v_existing_wallet_credit IS NULL OR v_existing_wallet_balance IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Redemption idempotency ledger is incomplete'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'points_deducted', v_existing_points_deducted,
      'wallet_credited', v_existing_wallet_credit,
      'new_points_balance', v_existing_points_balance,
      'new_wallet_balance', v_existing_wallet_balance
    );
  END IF;

  IF v_current_points < p_points THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient loyalty points');
  END IF;

  v_new_points := v_current_points - p_points;

  UPDATE public.customers
  SET loyalty_points = v_new_points, updated_at = now()
  WHERE id = p_customer_id;

  INSERT INTO public.customer_wallets AS cw (
    customer_id,
    merchant_id,
    available_balance,
    total_earned
  )
  VALUES (
    p_customer_id,
    p_merchant_id,
    v_effective_wallet_credit,
    v_effective_wallet_credit
  )
  ON CONFLICT (customer_id)
  DO UPDATE
  SET
    available_balance = COALESCE(cw.available_balance, 0) + v_effective_wallet_credit,
    total_earned = COALESCE(cw.total_earned, 0) + v_effective_wallet_credit,
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
    metadata,
    description
  ) VALUES (
    v_wallet_id,
    p_customer_id,
    p_merchant_id,
    'bonus',
    v_effective_wallet_credit,
    v_new_balance,
    'loyalty_redemption',
    v_redemption_id,
    jsonb_build_object(
      'pointsRedeemed', p_points,
      'redemptionId', v_redemption_id
    ),
    'Loyalty points redemption (' || p_points || ' points)'
  )
  RETURNING id INTO v_wallet_transaction_id;

  INSERT INTO public.points_transactions (
    customer_id,
    merchant_id,
    type,
    points,
    balance_after,
    source,
    source_id,
    description,
    metadata
  ) VALUES (
    p_customer_id,
    p_merchant_id,
    'redeem',
    -p_points,
    v_new_points,
    'wallet_redemption',
    v_redemption_id::text,
    'Points redeemed to wallet credit',
    jsonb_build_object(
      'redemptionId', v_redemption_id,
      'walletCredit', v_effective_wallet_credit,
      'walletTransactionId', v_wallet_transaction_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'points_deducted', p_points,
    'wallet_credited', v_effective_wallet_credit,
    'new_points_balance', v_new_points,
    'new_wallet_balance', v_new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_loyalty_points(uuid, uuid, integer, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_points(uuid, uuid, integer, numeric, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_points integer,
  p_wallet_credit numeric
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'success', false,
    'error', 'Please update the app to redeem loyalty points securely'
  );
$$;

REVOKE ALL ON FUNCTION public.redeem_loyalty_points(uuid, uuid, integer, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_points(uuid, uuid, integer, numeric) TO authenticated, service_role;
