-- Harden remaining helper RPC grants surfaced by Supabase advisors.
--
-- This intentionally avoids public storefront and checkout RPCs. The changes
-- below target helper functions that either mutate internal wallet/order state
-- or expose merchant/staff data by caller-supplied UUIDs.

CREATE OR REPLACE FUNCTION public.get_or_create_merchant_wallet(
  p_merchant_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT mw.id
    INTO v_wallet_id
  FROM public.merchant_wallets AS mw
  WHERE mw.merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.merchant_wallets (
      merchant_id,
      available_balance,
      pending_balance
    )
    VALUES (p_merchant_id, 0, 0)
    ON CONFLICT (merchant_id) DO NOTHING
    RETURNING id INTO v_wallet_id;

    IF v_wallet_id IS NULL THEN
      SELECT mw.id
        INTO v_wallet_id
      FROM public.merchant_wallets AS mw
      WHERE mw.merchant_id = p_merchant_id;
    END IF;
  END IF;

  RETURN v_wallet_id;
END;
$$;

COMMENT ON FUNCTION public.get_or_create_merchant_wallet(uuid) IS
  'Returns or creates a merchant wallet for the service role or callers with merchant access.';

CREATE OR REPLACE FUNCTION public.get_staff_permissions(
  p_staff_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role public.staff_role;
  v_custom_permissions jsonb;
  v_default_permissions jsonb;
  v_merchant_id uuid;
  v_staff_user_id uuid;
BEGIN
  IF p_staff_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT sm.role, sm.permissions, sm.merchant_id, sm.user_id
    INTO v_role, v_custom_permissions, v_merchant_id, v_staff_user_id
  FROM public.staff_members AS sm
  WHERE sm.id = p_staff_id;

  IF v_role IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND (SELECT auth.uid()) IS DISTINCT FROM v_staff_user_id
    AND NOT public.has_merchant_access(v_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT rp.permissions
    INTO v_default_permissions
  FROM public.role_permissions AS rp
  WHERE rp.role = v_role;

  RETURN COALESCE(v_default_permissions, '{}'::jsonb)
    || COALESCE(v_custom_permissions, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_staff_permissions(uuid) IS
  'Returns effective staff permissions to the service role, the staff member, or callers with merchant access.';

CREATE OR REPLACE FUNCTION public.get_unread_notification_count(
  p_merchant_id uuid
) RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN COALESCE(auth.role(), '') = 'service_role'
      OR public.has_merchant_access(p_merchant_id)
    THEN (
      SELECT COUNT(*)::integer
      FROM public.merchant_notifications AS mn
      WHERE mn.merchant_id = p_merchant_id
        AND mn.read_at IS NULL
        AND mn.dismissed_at IS NULL
    )
    ELSE 0::integer
  END;
$$;

COMMENT ON FUNCTION public.get_unread_notification_count(uuid) IS
  'Returns unread merchant notification count for the service role or callers with merchant access.';

REVOKE EXECUTE ON FUNCTION public.get_or_create_merchant_wallet(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_merchant_wallet(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_staff_permissions(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_permissions(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_unread_notification_count(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.refund_customer_wallet_for_vtu(
  uuid,
  uuid,
  numeric,
  uuid,
  text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_customer_wallet_for_vtu(
  uuid,
  uuid,
  numeric,
  uuid,
  text
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_or_create_customer_wallet(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_customer_wallet(uuid, uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_merchant_id_for_user(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_id_for_user(uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.search_order_by_number(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_order_by_number(uuid, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_active_staff_of(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_staff_of(uuid, uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.calculate_order_vat(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_order_vat(uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.generate_order_number_for_merchant(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number_for_merchant(uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.generate_improved_order_number(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_improved_order_number(uuid)
  TO service_role;
