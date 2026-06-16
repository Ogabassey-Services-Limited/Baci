-- Harden access helper functions exposed through older RLS policy shapes.
--
-- Public storefronts still need published page configs anonymously. Merchant
-- owners and staff still need draft/admin access when authenticated. The helper
-- functions below are no longer allowed to answer questions about arbitrary
-- user ids for direct REST/RPC callers.

CREATE OR REPLACE FUNCTION public.check_staff_permission(
  p_user_id uuid,
  p_merchant_id uuid,
  p_resource text,
  p_action text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_owner boolean;
  v_staff_permissions jsonb;
BEGIN
  IF p_user_id IS NULL OR p_merchant_id IS NULL THEN
    RETURN false;
  END IF;

  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RETURN false;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.merchants AS m
    WHERE m.id = p_merchant_id
      AND m.user_id = p_user_id
  ) INTO v_is_owner;

  IF v_is_owner THEN
    RETURN true;
  END IF;

  SELECT public.get_staff_permissions(sm.id)
    INTO v_staff_permissions
  FROM public.staff_members AS sm
  WHERE sm.merchant_id = p_merchant_id
    AND sm.user_id = p_user_id
    AND sm.status = 'active';

  IF v_staff_permissions IS NULL THEN
    RETURN false;
  END IF;

  RETURN COALESCE(
    (v_staff_permissions -> p_resource ->> p_action)::boolean,
    false
  );
END;
$$;

COMMENT ON FUNCTION public.check_staff_permission(uuid, uuid, text, text) IS
  'Checks staff permissions only for the current caller or the service role.';

CREATE OR REPLACE FUNCTION public.get_user_merchant_access(
  p_user_id uuid
) RETURNS TABLE(
  merchant_id uuid,
  merchant_name text,
  is_owner boolean,
  role public.staff_role,
  permissions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id AS merchant_id,
    m.business_name AS merchant_name,
    true AS is_owner,
    NULL::public.staff_role AS role,
    '{"full_access": true}'::jsonb AS permissions
  FROM public.merchants AS m
  WHERE m.user_id = p_user_id;

  RETURN QUERY
  SELECT
    sm.merchant_id,
    m.business_name AS merchant_name,
    false AS is_owner,
    sm.role,
    public.get_staff_permissions(sm.id) AS permissions
  FROM public.staff_members AS sm
  JOIN public.merchants AS m ON m.id = sm.merchant_id
  WHERE sm.user_id = p_user_id
    AND sm.status = 'active';
END;
$$;

COMMENT ON FUNCTION public.get_user_merchant_access(uuid) IS
  'Returns merchant access for the current caller or the service role.';

DROP POLICY IF EXISTS "Select page configs" ON public.page_configs;

CREATE POLICY "Public can select published page configs"
  ON public.page_configs
  FOR SELECT
  TO anon
  USING (is_published = true);

CREATE POLICY "Authenticated can select page configs"
  ON public.page_configs
  FOR SELECT
  TO authenticated
  USING (
    is_published = true
    OR public.has_merchant_access(merchant_id)
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'builder',
      'view'
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'builder',
      'edit'
    )
  );

DROP POLICY IF EXISTS "Staff can delete page configs" ON public.page_configs;
DROP POLICY IF EXISTS "Staff can insert page configs" ON public.page_configs;
DROP POLICY IF EXISTS "Staff can update page configs" ON public.page_configs;

CREATE POLICY "Authenticated can delete page configs"
  ON public.page_configs
  FOR DELETE
  TO authenticated
  USING (
    public.has_merchant_access(merchant_id)
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'builder',
      'edit'
    )
  );

CREATE POLICY "Authenticated can insert page configs"
  ON public.page_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_merchant_access(merchant_id)
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'builder',
      'edit'
    )
  );

CREATE POLICY "Authenticated can update page configs"
  ON public.page_configs
  FOR UPDATE
  TO authenticated
  USING (
    public.has_merchant_access(merchant_id)
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'builder',
      'edit'
    )
  )
  WITH CHECK (
    public.has_merchant_access(merchant_id)
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'builder',
      'edit'
    )
  );

REVOKE EXECUTE ON FUNCTION public.get_user_merchant_access(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_merchant_access(uuid)
  TO service_role;
