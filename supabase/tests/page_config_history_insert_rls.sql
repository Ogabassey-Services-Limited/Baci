-- =============================================
-- REGRESSION TEST: page_config_history INSERT RLS
--   Ensures builder publishers can archive history rows while insert access
--   stays scoped to the parent page_configs merchant AND the builder.edit
--   permission (owner, or staff whose effective permissions grant it) —
--   mirroring the publish route's hasPermission(access, 'builder', 'edit').
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/page_config_history_insert_rls.sql
-- =============================================

BEGIN;

DO $$
DECLARE
  policy_roles text;
  check_expr text;
BEGIN
  SELECT
    array_to_string(polroles::regrole[]::text[], ','),
    pg_get_expr(polwithcheck, polrelid)
  INTO policy_roles, check_expr
  FROM pg_policy
  WHERE polrelid = 'public.page_config_history'::regclass
    AND polname = 'Staff can insert page config history'
    AND polcmd = 'a';

  IF policy_roles IS NULL THEN
    RAISE EXCEPTION 'page_config_history INSERT policy is missing';
  END IF;

  IF policy_roles NOT LIKE '%authenticated%' THEN
    RAISE EXCEPTION
      'page_config_history INSERT policy must apply to authenticated, found %',
      policy_roles;
  END IF;

  IF check_expr IS NULL
    OR check_expr NOT LIKE '%page_configs%'
    OR check_expr NOT LIKE '%check_staff_permission%'
    OR check_expr NOT LIKE '%merchant_id%'
    OR check_expr NOT LIKE '%builder%'
    OR check_expr NOT LIKE '%edit%'
  THEN
    RAISE EXCEPTION
      'page_config_history INSERT policy must scope through page_configs and the builder.edit permission, found %',
      check_expr;
  END IF;

  IF check_expr LIKE '%has_merchant_access%' THEN
    RAISE EXCEPTION
      'page_config_history INSERT policy must use check_staff_permission (builder.edit), not the broader has_merchant_access, found %',
      check_expr;
  END IF;

  IF check_expr LIKE '%auth.role%'
    OR check_expr LIKE '%true%'
  THEN
    RAISE EXCEPTION
      'page_config_history INSERT policy must not be role-only or permissive, found %',
      check_expr;
  END IF;
END $$;

ROLLBACK;
