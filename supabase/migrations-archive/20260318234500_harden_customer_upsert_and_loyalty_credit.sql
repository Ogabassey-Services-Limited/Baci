-- Append-only follow-up for 20260318233000.
-- Clarification: despite its header text, the wallet upsert in 20260318233000
-- uses ON CONFLICT (customer_id). This migration preserves that single-column
-- conflict target and hardens related RPC behavior.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Harden upsert_customer_on_auth:
--    - non-service callers must match both auth.uid() and email claim
--    - conflict update only when row is unclaimed or already owned by caller
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_customer_on_auth(
  p_merchant_id UUID,
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_caller_uid UUID;
  v_caller_role TEXT;
  v_caller_email TEXT;
BEGIN
  v_caller_uid := (SELECT auth.uid());
  v_caller_role := (SELECT auth.role());
  v_caller_email := NULLIF(current_setting('request.jwt.claim.email', true), '');

  IF v_caller_email IS NULL THEN
    v_caller_email := NULLIF(auth.jwt() ->> 'email', '');
  END IF;

  IF v_caller_role <> 'service_role'
     AND (v_caller_uid IS NULL OR v_caller_uid IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_caller_role <> 'service_role'
     AND (
       p_email IS NULL
       OR v_caller_email IS NULL
       OR lower(p_email) IS DISTINCT FROM lower(v_caller_email)
     ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO customers (merchant_id, user_id, email, full_name, phone, last_login_at)
  VALUES (
    p_merchant_id,
    p_user_id,
    p_email,
    COALESCE(p_full_name, split_part(p_email, '@', 1)),
    p_phone,
    NOW()
  )
  ON CONFLICT (merchant_id, email) WHERE email IS NOT NULL
  DO UPDATE SET
    user_id = COALESCE(customers.user_id, EXCLUDED.user_id),
    full_name = CASE
      WHEN EXCLUDED.full_name IS NULL THEN customers.full_name
      WHEN EXCLUDED.full_name = split_part(EXCLUDED.email, '@', 1)
           AND customers.full_name IS NOT NULL THEN customers.full_name
      ELSE EXCLUDED.full_name
    END,
    phone = COALESCE(EXCLUDED.phone, customers.phone),
    last_login_at = NOW(),
    updated_at = NOW()
  WHERE customers.user_id IS NULL OR customers.user_id = EXCLUDED.user_id
  RETURNING id INTO v_customer_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer email is already claimed by another user';
  END IF;

  RETURN v_customer_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Harden redeem_loyalty_points:
--    - compute wallet credit server-side from merchant loyalty settings
--    - ignore client-provided p_wallet_credit for balance/ledger writes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_customer_id UUID,
  p_merchant_id UUID,
  p_points INTEGER,
  -- Backward-compatibility parameter. Ignored intentionally; credit is computed server-side.
  p_wallet_credit NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_caller_role TEXT;
  v_current_points INTEGER;
  v_customer_merchant_id UUID;
  v_customer_user_id UUID;
  v_new_points INTEGER;
  v_new_balance NUMERIC;
  v_wallet_id UUID;
  v_points_to_currency_ratio NUMERIC;
  v_minimum_redemption_points INTEGER;
  v_effective_wallet_credit NUMERIC;
BEGIN
  v_caller_uid := (SELECT auth.uid());
  v_caller_role := (SELECT auth.role());

  IF p_points <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid redemption amount');
  END IF;

  SELECT ls.points_to_currency_ratio, ls.minimum_redemption_points
  INTO v_points_to_currency_ratio, v_minimum_redemption_points
  FROM public.loyalty_settings ls
  WHERE ls.merchant_id = p_merchant_id
  LIMIT 1;

  v_points_to_currency_ratio := COALESCE(v_points_to_currency_ratio, 0.01);
  v_minimum_redemption_points := GREATEST(COALESCE(v_minimum_redemption_points, 1), 1);
  v_effective_wallet_credit := ROUND((p_points::NUMERIC * v_points_to_currency_ratio)::NUMERIC, 2);

  IF p_points < v_minimum_redemption_points THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Minimum redemption is %s points', v_minimum_redemption_points)
    );
  END IF;

  IF v_effective_wallet_credit <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid redemption configuration');
  END IF;

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

  IF v_caller_role <> 'service_role'
     AND (
       v_caller_uid IS NULL
       OR (
         v_customer_user_id IS DISTINCT FROM v_caller_uid
         AND NOT has_merchant_access(p_merchant_id)
       )
     ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF v_current_points < p_points THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient points');
  END IF;

  v_new_points := v_current_points - p_points;

  UPDATE public.customers
  SET loyalty_points = v_new_points, updated_at = now()
  WHERE id = p_customer_id;

  INSERT INTO public.customer_wallets (customer_id, merchant_id, available_balance)
  VALUES (p_customer_id, p_merchant_id, v_effective_wallet_credit)
  ON CONFLICT (customer_id)
  DO UPDATE
  SET
    available_balance = customer_wallets.available_balance + v_effective_wallet_credit,
    updated_at = now()
  RETURNING id, available_balance INTO v_wallet_id, v_new_balance;

  INSERT INTO public.wallet_transactions (
    wallet_id, merchant_id, type, amount, description, source_type, status
  ) VALUES (
    v_wallet_id,
    p_merchant_id,
    'credit',
    v_effective_wallet_credit,
    'Loyalty points redemption (' || p_points || ' points)',
    'loyalty_redemption',
    'completed'
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

GRANT EXECUTE ON FUNCTION public.upsert_customer_on_auth(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_customer_on_auth(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_points(UUID, UUID, INTEGER, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_points(UUID, UUID, INTEGER, NUMERIC) TO service_role;

COMMIT;
