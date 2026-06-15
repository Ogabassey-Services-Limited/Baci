-- Fix ambiguous column references in get_user_access RPC.
-- The RETURNS TABLE column names (merchant_id, role, permissions) clashed with
-- identically-named columns in staff_members and role_permissions tables.

CREATE OR REPLACE FUNCTION public.get_user_access()
RETURNS TABLE (
  merchant_id uuid,
  role text,
  is_owner boolean,
  is_staff boolean,
  permissions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_staff record;
  v_default_permissions jsonb;
  v_permissions jsonb;
  resource text;
  actions jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Owner access
  SELECT m.id INTO v_owner_id
  FROM merchants m
  WHERE m.user_id = v_user_id
  LIMIT 1;

  IF v_owner_id IS NOT NULL THEN
    merchant_id := v_owner_id;
    role := 'owner';
    is_owner := true;
    is_staff := false;
    permissions := jsonb_build_object('*', jsonb_build_object('*', true));
    RETURN NEXT;
    RETURN;
  END IF;

  -- Staff access (table-qualify to avoid ambiguity with RETURNS TABLE columns)
  SELECT sm.merchant_id, sm.role, sm.permissions INTO v_staff
  FROM staff_members sm
  WHERE sm.user_id = v_user_id
    AND sm.status = 'active'
  LIMIT 1;

  IF v_staff.merchant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT rp.permissions INTO v_default_permissions
  FROM role_permissions rp
  WHERE rp.role = v_staff.role;

  v_permissions := COALESCE(v_default_permissions, '{}'::jsonb);

  IF v_staff.permissions IS NOT NULL THEN
    FOR resource, actions IN
      SELECT key, value FROM jsonb_each(v_staff.permissions)
    LOOP
      v_permissions := jsonb_set(
        v_permissions,
        ARRAY[resource],
        COALESCE(v_permissions -> resource, '{}'::jsonb) || actions,
        true
      );
    END LOOP;
  END IF;

  merchant_id := v_staff.merchant_id;
  role := v_staff.role::text;
  is_owner := false;
  is_staff := true;
  permissions := v_permissions;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_access() TO authenticated;
