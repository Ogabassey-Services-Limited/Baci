-- Align RLS staff-permission checks with application-level permission grants.
-- The web and mobile APIs treat resource-level `all`, `full_access.all`, and
-- JSON wildcard grants as broader permissions; RLS helpers must do the same so
-- scoped client writes do not pass app authorization and then silently no-op.

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
    (v_staff_permissions -> '*' ->> '*')::boolean,
    (v_staff_permissions -> '*' ->> p_action)::boolean,
    (v_staff_permissions -> p_resource ->> '*')::boolean,
    (v_staff_permissions -> p_resource ->> p_action)::boolean,
    (v_staff_permissions -> p_resource ->> 'all')::boolean,
    (v_staff_permissions -> 'full_access' ->> 'all')::boolean,
    false
  );
END;
$$;

COMMENT ON FUNCTION public.check_staff_permission(uuid, uuid, text, text) IS
  'Checks staff permissions only for the current caller or the service role, including all and wildcard grants.';
