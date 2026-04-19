-- Follow-up fixes for historical migrations restored from remote history.
-- Keep prior migration files immutable; patch behavior with append-only changes.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Restore public storefront visibility for non-admin merchants.
--    20260226191000/20260226191453 dropped "Consolidated view permissions".
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view merchants" ON public.merchants;
CREATE POLICY "Public can view merchants" ON public.merchants
  FOR SELECT
  USING (is_platform_admin IS NOT TRUE);

-- ---------------------------------------------------------------------------
-- 2) Restore merchant CRUD access to ai_generated_topics.
--    20260225151237 dropped merchant FOR ALL and only recreated staff INSERT.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Merchants can manage their own ai topics" ON public.ai_generated_topics;
CREATE POLICY "Merchants can manage their own ai topics" ON public.ai_generated_topics
  FOR ALL TO authenticated
  USING (
    merchant_id IN (
      SELECT m.id
      FROM public.merchants m
      WHERE m.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    merchant_id IN (
      SELECT m.id
      FROM public.merchants m
      WHERE m.user_id = (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Fix upsert_customer_on_auth name merge behavior.
--    Do not overwrite existing real names with default email-prefix fallback.
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
BEGIN
  v_caller_uid := (SELECT auth.uid());
  v_caller_role := (SELECT auth.role());

  IF v_caller_role <> 'service_role'
     AND (v_caller_uid IS NULL OR v_caller_uid IS DISTINCT FROM p_user_id) THEN
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
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Fix redeem_loyalty_points wallet upsert conflict target.
--    Use composite key (customer_id, merchant_id) for multi-merchant safety.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_customer_id UUID,
  p_merchant_id UUID,
  p_points INTEGER,
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
BEGIN
  v_caller_uid := (SELECT auth.uid());
  v_caller_role := (SELECT auth.role());

  IF p_points <= 0 OR p_wallet_credit <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid redemption amount');
  END IF;

  SELECT loyalty_points, merchant_id, user_id
  INTO v_current_points, v_customer_merchant_id, v_customer_user_id
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF v_current_points IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
  END IF;

  IF v_customer_merchant_id IS DISTINCT FROM p_merchant_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer merchant mismatch');
  END IF;

  IF v_caller_role <> 'service_role'
     AND (v_caller_uid IS NULL
          OR (
            v_customer_user_id IS DISTINCT FROM v_caller_uid
            AND NOT has_merchant_access(p_merchant_id)
          )) THEN
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
  VALUES (p_customer_id, p_merchant_id, p_wallet_credit)
  ON CONFLICT (customer_id)
  DO UPDATE
  SET
    available_balance = customer_wallets.available_balance + p_wallet_credit,
    updated_at = now()
  RETURNING id, available_balance INTO v_wallet_id, v_new_balance;

  INSERT INTO public.wallet_transactions (
    wallet_id, merchant_id, type, amount, description, source_type, status
  ) VALUES (
    v_wallet_id,
    p_merchant_id,
    'credit',
    p_wallet_credit,
    'Loyalty points redemption (' || p_points || ' points)',
    'loyalty_redemption',
    'completed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'points_deducted', p_points,
    'wallet_credited', p_wallet_credit,
    'new_points_balance', v_new_points,
    'new_wallet_balance', v_new_balance
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Harden storefront variants RPC against tenant mismatch rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_storefront_product_variants(
  p_product_ids UUID[]
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  sku TEXT,
  attributes JSONB,
  price_override NUMERIC,
  stock_quantity INTEGER,
  images JSONB,
  primary_image TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    pv.id,
    pv.product_id,
    pv.sku,
    pv.attributes,
    pv.price_override,
    pv.stock_quantity,
    pv.images,
    pv.primary_image,
    pv.created_at,
    pv.updated_at
  FROM public.product_variants pv
  JOIN public.products p ON p.id = pv.product_id
  JOIN public.merchants m ON m.id = p.merchant_id
  WHERE pv.product_id = ANY(COALESCE(p_product_ids, ARRAY[]::UUID[]))
    AND pv.merchant_id = p.merchant_id
    AND p.status = 'active'
    AND COALESCE(m.is_published, false) = true;
$$;

COMMIT;
