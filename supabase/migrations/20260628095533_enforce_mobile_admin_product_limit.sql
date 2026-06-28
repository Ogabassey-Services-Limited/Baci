CREATE OR REPLACE FUNCTION private.enforce_mobile_admin_product_limit(
  p_merchant_id uuid,
  p_product_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_active_product_count integer;
  v_is_new_product boolean;
  v_plan_expires_at timestamptz;
  v_plan_tier text;
  v_premium_features jsonb;
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden_mobile_admin_product_limit_check' USING ERRCODE = '42501';
  END IF;

  SELECT NOT EXISTS (
    SELECT 1
    FROM public.products
    WHERE id = p_product_id
      AND merchant_id = p_merchant_id
  ) INTO v_is_new_product;

  IF NOT v_is_new_product THEN
    RETURN;
  END IF;

  SELECT
    m.plan_tier,
    m.plan_expires_at,
    COALESCE(m.premium_features, '[]'::jsonb)
  INTO
    v_plan_tier,
    v_plan_expires_at,
    v_premium_features
  FROM public.merchants m
  WHERE m.id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found_for_product_limit_check' USING ERRCODE = '23503';
  END IF;

  IF v_plan_tier IN ('pro', 'business', 'enterprise')
     AND (v_plan_expires_at IS NULL OR v_plan_expires_at > now()) THEN
    RETURN;
  END IF;

  IF v_premium_features ?| ARRAY[
    'all_features',
    'product_limit',
    'unlimited_products',
    'bulk_product_import'
  ] THEN
    RETURN;
  END IF;

  SELECT count(*)::integer
  INTO v_active_product_count
  FROM public.products
  WHERE merchant_id = p_merchant_id
    AND status <> 'archived';

  IF v_active_product_count >= 1000 THEN
    RAISE SQLSTATE 'PGRST' USING
      message = json_build_object(
        'code', 'requires_upgrade',
        'message', 'Product limit reached',
        'details', 'Free plan merchants can create up to 1000 active products.',
        'hint', 'Upgrade to Baci Pro to add more products.'
      )::text,
      detail = json_build_object('status', 402)::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_mobile_admin_product_with_variants(
  p_merchant_id uuid,
  p_product_id uuid,
  p_product_payload jsonb,
  p_variants_payload jsonb,
  p_actor_role text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  PERFORM private.enforce_mobile_admin_product_limit(p_merchant_id, p_product_id);

  RETURN private.save_mobile_admin_product_with_variants(
    p_merchant_id,
    p_product_id,
    p_product_payload,
    p_variants_payload,
    p_actor_role
  );
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_mobile_admin_product_limit(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.enforce_mobile_admin_product_limit(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.save_mobile_admin_product_with_variants(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_mobile_admin_product_with_variants(uuid, uuid, jsonb, jsonb, text) TO authenticated, service_role;
