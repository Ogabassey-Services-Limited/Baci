-- ============================================================================
-- S1 PR 3a: make get_staff_permissions PER-RESOURCE deep-merge role defaults
--           with a staff member's custom permissions.
-- ============================================================================
-- Before this migration, get_staff_permissions merged with a SHALLOW jsonb `||`
-- (COALESCE(defaults,'{}') || COALESCE(custom,'{}')). A single custom top-level
-- key such as `integrations: {"manage": true}` REPLACED the whole default
-- `integrations` object and silently dropped its `view: true`. Every other
-- effective-permission computation in the codebase already DEEP-merges per
-- resource, so this RPC was the lone divergent surface:
--
--   * public.get_user_access()  (20260612062153) -- server API authorizer
--       -> loops jsonb_each(custom) and sets
--          `COALESCE(v_permissions -> resource, '{}') || actions` (deep merge).
--   * apps/web/src/lib/get-merchant-for-api-request.ts -- server route gate
--       -> `mergedPermissions[resource] = { ...mergedPermissions[resource],
--          ...actions }` (deep merge).
--   * apps/web/src/hooks/merchant/queries.ts fetchDashboardMerchant -- client /
--     MerchantProvider gate -> identical per-resource spread (deep merge).
--   * apps/web/src/lib/permission-grant.ts permissionGrantsAccess -- the shared
--     authorizer that READS a merged map; it OR-checks wildcard/all/action, so
--     it depends on defaults being preserved (deep merge), not clobbered.
--
-- This migration aligns get_staff_permissions with that established deep-merge
-- semantics using the exact construction get_user_access already runs in
-- production, so RLS and the app converge on one permission model.
--
-- Consumer audit (item A) -- every reader of get_staff_permissions /
-- check_staff_permission and why deep merge makes each MORE aligned, never
-- less safe. Deep merge only ever PRESERVES default sub-keys that a custom
-- object used to clobber; it never removes a permission that shallow merge
-- granted (an explicit custom `false` for a specific action still wins, exactly
-- as before, because that action key is present on the right side of `||`).
--
--   1. public.check_staff_permission(uuid,uuid,text,text)
--      (current def 20260705143000, wildcard-aware): returns true when any of
--      `*.*`, `*.action`, `resource.*`, `resource.action`, `resource.all`,
--      `full_access.all` is present-and-true. Deep merge can only keep MORE of
--      those default grants that a partial custom object previously dropped, so
--      RLS now grants exactly what the app authorizer (which already deep-
--      merges) grants. This is the divergence that PR #3173 /
--      20260723210000_scope_subaccount_rpc_staff_permission.sql worked around
--      by OR-ing sibling actions in RPC predicates; deep merge removes the
--      root cause (those OR predicates stay correct and become belt-and-braces).
--   2. public.get_user_merchant_access(uuid) (20260612061125, service_role-only)
--      returns get_staff_permissions per staff row for context/display. Deep
--      merge makes its output match get_user_access for the same staff member.
--   3. GET /api/staff/[id] (apps/web/src/app/api/staff/[id]/route.ts) surfaces
--      get_staff_permissions as `effectivePermissions` for the staff-management
--      UI. Deep merge makes the DISPLAYED effective permissions match what the
--      app actually enforces (which already deep-merges everywhere).
--
--   No consumer relies on custom-object REPLACEMENT to REMOVE a default
--   permission: the role_permissions defaults are a clean {resource:{action}}
--   map, staff custom writes flow through staffUpdateSchema
--   (z.record(resource, z.record(action, boolean))), and all three app
--   authorizers already deep-merge, so the product's effective behavior was
--   ALREADY deep-merge -- only this shallow RPC (and the RLS/display paths that
--   read it) diverged. Shipping is therefore safe: it removes a bug surface,
--   it does not change any relied-upon removal semantics.
--
-- Preserves the SECURITY DEFINER + `SET search_path = ''` hardening and the
-- caller-or-service_role-or-has_merchant_access guard from 20260612054548
-- exactly. Idempotent CREATE OR REPLACE with a defensively restated
-- REVOKE/GRANT (Supabase default privileges grant EXECUTE to anon on function
-- creation and REVOKE FROM PUBLIC alone is a no-op).
-- ============================================================================

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
  v_effective_permissions jsonb;
  v_resource text;
  v_actions jsonb;
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

  -- Guard preserved verbatim from 20260612054548: only the staff member, the
  -- service role, or a caller with merchant access may resolve permissions.
  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND (SELECT auth.uid()) IS DISTINCT FROM v_staff_user_id
    AND NOT public.has_merchant_access(v_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT rp.permissions
    INTO v_default_permissions
  FROM public.role_permissions AS rp
  WHERE rp.role = v_role;

  -- Per-resource deep merge: start from the role defaults, then for each custom
  -- resource key overlay `default_resource_object || custom_resource_object` so
  -- individual custom actions win while sibling default actions are preserved.
  -- Keys present only in defaults are kept as-is; keys present only in the
  -- custom object are added (COALESCE(... , '{}') || custom => custom).
  v_effective_permissions := COALESCE(v_default_permissions, '{}'::jsonb);

  IF v_custom_permissions IS NOT NULL THEN
    FOR v_resource, v_actions IN
      SELECT e.key, e.value
      FROM pg_catalog.jsonb_each(v_custom_permissions) AS e(key, value)
    LOOP
      v_effective_permissions := pg_catalog.jsonb_set(
        v_effective_permissions,
        ARRAY[v_resource],
        COALESCE(v_effective_permissions -> v_resource, '{}'::jsonb)
          || v_actions,
        true
      );
    END LOOP;
  END IF;

  RETURN v_effective_permissions;
END;
$$;

COMMENT ON FUNCTION public.get_staff_permissions(uuid) IS
  'Returns effective staff permissions (role defaults per-resource deep-merged with custom overrides) to the service role, the staff member, or callers with merchant access.';

REVOKE EXECUTE ON FUNCTION public.get_staff_permissions(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_permissions(uuid)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
