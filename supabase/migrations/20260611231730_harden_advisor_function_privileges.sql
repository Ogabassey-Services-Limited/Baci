-- Harden low-risk Supabase advisor findings without changing guest checkout RPCs.
--
-- This migration intentionally avoids broad SECURITY DEFINER revokes. Several
-- public storefront and checkout RPCs are intentionally reachable by anonymous
-- shoppers. The changes below target functions that are authenticated/admin
-- helpers, add missing in-function authorization where needed, and remove
-- anonymous execution grants.

ALTER FUNCTION public.current_agentic_session_id()
  SET search_path = '';

ALTER FUNCTION public.get_storefront_category_slug_state(uuid, text)
  SET search_path = '';

ALTER FUNCTION private.get_storefront_category_slug_state(uuid, text)
  SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_merchant_balance(
  merchant_id_param uuid,
  currency_param text
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  balance numeric;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND NOT public.has_merchant_access(merchant_id_param) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(mb.available_balance, 0.00)
    INTO balance
  FROM public.merchant_balances AS mb
  WHERE mb.merchant_id = merchant_id_param
    AND mb.currency = currency_param;

  RETURN COALESCE(balance, 0.00);
END;
$$;

COMMENT ON FUNCTION public.get_merchant_balance(uuid, text) IS
  'Returns merchant balance for the service role or callers with merchant access.';

CREATE OR REPLACE FUNCTION public.get_merchant_push_tokens(
  p_merchant_id uuid
) RETURNS TABLE(token text, platform text, device_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pt.token, pt.platform, pt.device_name
  FROM public.push_tokens AS pt
  WHERE pt.merchant_id = p_merchant_id
    AND pt.is_active IS TRUE
    AND pt.app_type = 'admin'
    AND (
      COALESCE(auth.role(), '') = 'service_role'
      OR public.has_merchant_access(p_merchant_id)
    );
$$;

COMMENT ON FUNCTION public.get_merchant_push_tokens(uuid) IS
  'Returns active admin push tokens for the service role or callers with merchant access.';

CREATE OR REPLACE FUNCTION public.decrement_product_stock(
  product_id_param uuid,
  quantity_param integer
) RETURNS TABLE(success boolean, new_stock integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_stock integer;
  updated_stock integer;
  v_manage_stock boolean;
  v_merchant_id uuid;
BEGIN
  IF product_id_param IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Product ID cannot be null'::text;
    RETURN;
  END IF;

  IF quantity_param <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 'Quantity must be positive'::text;
    RETURN;
  END IF;

  SELECT p.merchant_id, p.manage_stock
    INTO v_merchant_id, v_manage_stock
  FROM public.products AS p
  WHERE p.id = product_id_param;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'Product not found'::text;
    RETURN;
  END IF;

  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND NOT public.has_merchant_access(v_merchant_id) THEN
    RETURN QUERY SELECT FALSE, NULL::integer, 'Not authorized'::text;
    RETURN;
  END IF;

  IF NOT COALESCE(v_manage_stock, false) THEN
    RETURN QUERY SELECT TRUE, NULL::integer, 'Stock management disabled - unlimited stock'::text;
    RETURN;
  END IF;

  SELECT p.stock_quantity
    INTO current_stock
  FROM public.products AS p
  WHERE p.id = product_id_param
  FOR UPDATE;

  IF current_stock < quantity_param THEN
    RETURN QUERY SELECT FALSE, current_stock, 'Insufficient stock'::text;
    RETURN;
  END IF;

  UPDATE public.products AS p
  SET stock_quantity = p.stock_quantity - quantity_param,
      updated_at = pg_catalog.clock_timestamp()
  WHERE p.id = product_id_param
  RETURNING p.stock_quantity INTO updated_stock;

  RETURN QUERY SELECT TRUE, updated_stock, 'Stock updated successfully'::text;
END;
$$;

COMMENT ON FUNCTION public.decrement_product_stock(uuid, integer) IS
  'Atomically decrements product stock for the service role or callers with merchant access.';

CREATE OR REPLACE FUNCTION public.decrement_variant_stock(
  variant_id_param uuid,
  quantity_param integer
) RETURNS TABLE(success boolean, new_stock integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_stock integer;
  updated_stock integer;
  v_manage_stock boolean;
  v_merchant_id uuid;
BEGIN
  IF variant_id_param IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Variant ID cannot be null'::text;
    RETURN;
  END IF;

  IF quantity_param <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 'Quantity must be positive'::text;
    RETURN;
  END IF;

  SELECT p.merchant_id, p.manage_stock
    INTO v_merchant_id, v_manage_stock
  FROM public.products AS p
  JOIN public.product_variants AS pv ON pv.product_id = p.id
  WHERE pv.id = variant_id_param;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'Variant not found'::text;
    RETURN;
  END IF;

  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND NOT public.has_merchant_access(v_merchant_id) THEN
    RETURN QUERY SELECT FALSE, NULL::integer, 'Not authorized'::text;
    RETURN;
  END IF;

  IF NOT COALESCE(v_manage_stock, false) THEN
    RETURN QUERY SELECT TRUE, NULL::integer, 'Stock management disabled - unlimited stock'::text;
    RETURN;
  END IF;

  SELECT pv.stock_quantity
    INTO current_stock
  FROM public.product_variants AS pv
  WHERE pv.id = variant_id_param
  FOR UPDATE;

  IF current_stock < quantity_param THEN
    RETURN QUERY SELECT FALSE, current_stock, 'Insufficient stock'::text;
    RETURN;
  END IF;

  UPDATE public.product_variants AS pv
  SET stock_quantity = pv.stock_quantity - quantity_param,
      updated_at = pg_catalog.clock_timestamp()
  WHERE pv.id = variant_id_param
  RETURNING pv.stock_quantity INTO updated_stock;

  RETURN QUERY SELECT TRUE, updated_stock, 'Stock updated successfully'::text;
END;
$$;

COMMENT ON FUNCTION public.decrement_variant_stock(uuid, integer) IS
  'Atomically decrements variant stock for the service role or callers with merchant access.';

CREATE OR REPLACE FUNCTION public.set_primary_domain(
  merchant_id_param uuid,
  domain_id_param uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF merchant_id_param IS NULL OR domain_id_param IS NULL THEN
    RAISE EXCEPTION 'merchant_id and domain_id cannot be null';
  END IF;

  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND NOT public.has_merchant_access(merchant_id_param) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  UPDATE public.domains AS d
  SET is_primary = FALSE
  WHERE d.merchant_id = merchant_id_param
    AND d.is_primary IS TRUE;

  UPDATE public.domains AS d
  SET is_primary = TRUE
  WHERE d.id = domain_id_param
    AND d.merchant_id = merchant_id_param;
END;
$$;

COMMENT ON FUNCTION public.set_primary_domain(uuid, uuid) IS
  'Sets a primary domain for the service role or callers with merchant access.';

CREATE OR REPLACE FUNCTION public.send_notification_to_all_merchants(
  p_notification_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_is_platform_admin boolean;
BEGIN
  SELECT COALESCE((SELECT auth.role()), '') = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.merchants AS m
      WHERE m.user_id = auth.uid()
        AND m.is_platform_admin IS TRUE
    )
    INTO v_is_platform_admin;

  IF NOT COALESCE(v_is_platform_admin, false) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.merchant_notifications (notification_id, merchant_id)
  SELECT p_notification_id, m.id
  FROM public.merchants AS m
  WHERE m.user_id IS NOT NULL
  ON CONFLICT (notification_id, merchant_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.notifications AS n
  SET sent_at = pg_catalog.now()
  WHERE n.id = p_notification_id;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.send_notification_to_all_merchants(uuid) IS
  'Broadcasts a notification to all merchants for the service role or platform admins.';

CREATE OR REPLACE FUNCTION public.send_notification_to_merchants(
  p_notification_id uuid,
  p_merchant_ids uuid[]
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_is_platform_admin boolean;
BEGIN
  SELECT COALESCE((SELECT auth.role()), '') = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.merchants AS m
      WHERE m.user_id = auth.uid()
        AND m.is_platform_admin IS TRUE
    )
    INTO v_is_platform_admin;

  IF NOT COALESCE(v_is_platform_admin, false) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.merchant_notifications (notification_id, merchant_id)
  SELECT p_notification_id, selected_merchant_id
  FROM unnest(p_merchant_ids) AS selected_merchant_ids(selected_merchant_id)
  ON CONFLICT (notification_id, merchant_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.notifications AS n
  SET sent_at = pg_catalog.now()
  WHERE n.id = p_notification_id;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.send_notification_to_merchants(uuid, uuid[]) IS
  'Broadcasts a notification to selected merchants for the service role or platform admins.';

REVOKE EXECUTE ON FUNCTION public.apply_ai_storefront_draft(
  uuid, uuid, text, jsonb, timestamptz, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_ai_storefront_draft(
  uuid, uuid, text, jsonb, timestamptz, boolean
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_bvn_verification(
  uuid, text, text, text, date
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_bvn_verification(
  uuid, text, text, text, date
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_cac_verification(
  uuid, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_cac_verification(
  uuid, text, text, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_nin_verification(
  uuid, text, text, text, date
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nin_verification(
  uuid, text, text, text, date
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.save_mobile_admin_product_with_variants(
  uuid, uuid, jsonb, jsonb, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_mobile_admin_product_with_variants(
  uuid, uuid, jsonb, jsonb, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_customer_on_auth(
  uuid, uuid, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_customer_on_auth(
  uuid, uuid, text, text, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_merchant_balance(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_merchant_balance(uuid, text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_merchant_push_tokens(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_merchant_push_tokens(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.decrement_variant_stock(uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decrement_variant_stock(uuid, integer)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.set_primary_domain(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_primary_domain(uuid, uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.send_notification_to_all_merchants(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_notification_to_all_merchants(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.send_notification_to_merchants(uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_notification_to_merchants(uuid, uuid[])
  TO authenticated, service_role;
