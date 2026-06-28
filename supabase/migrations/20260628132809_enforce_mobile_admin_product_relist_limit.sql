CREATE OR REPLACE FUNCTION private.enforce_mobile_admin_product_relist_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_active_product_count integer;
  v_plan_expires_at timestamptz;
  v_plan_tier text;
  v_premium_features jsonb;
BEGIN
  IF OLD.status IS DISTINCT FROM 'archived'
     OR NEW.status = 'archived'
     OR NEW.status IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(NEW.merchant_id) THEN
    RAISE EXCEPTION 'forbidden_mobile_admin_product_relist_limit_check' USING ERRCODE = '42501';
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
  WHERE m.id = NEW.merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found_for_product_relist_limit_check' USING ERRCODE = '23503';
  END IF;

  IF v_plan_tier IN ('pro', 'business', 'enterprise')
     AND (v_plan_expires_at IS NULL OR v_plan_expires_at > now()) THEN
    RETURN NEW;
  END IF;

  IF v_premium_features ?| ARRAY[
    'all_features',
    'product_limit',
    'unlimited_products',
    'bulk_product_import'
  ] THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::integer
  INTO v_active_product_count
  FROM public.products
  WHERE merchant_id = NEW.merchant_id
    AND id <> NEW.id
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_mobile_admin_product_relist_limit ON public.products;
CREATE TRIGGER enforce_mobile_admin_product_relist_limit
  BEFORE UPDATE OF status ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_mobile_admin_product_relist_limit();

REVOKE ALL ON FUNCTION private.enforce_mobile_admin_product_relist_limit() FROM PUBLIC, anon, authenticated, service_role;
