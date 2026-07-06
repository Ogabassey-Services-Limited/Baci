-- =============================================
-- REGRESSION TEST: page_config_history INSERT RLS
--   Ensures merchant/staff publishers can archive builder history rows while
--   insert access remains scoped through the parent page_configs merchant.
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
    OR check_expr NOT LIKE '%has_merchant_access%'
    OR check_expr NOT LIKE '%merchant_id%'
  THEN
    RAISE EXCEPTION
      'page_config_history INSERT policy must scope through page_configs merchant access, found %',
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
