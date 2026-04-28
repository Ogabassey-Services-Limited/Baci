-- =============================================
-- REGRESSION TEST: categories public-read RLS
--   Locks the invariant established by migration
--   20260428152000_categories_public_read_for_authenticated_customers.sql
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/categories_public_read_authenticated.sql
--   or via Supabase MCP execute_sql
--
-- The script assert-fails (RAISE EXCEPTION) on any deviation, so it can
-- be wired into CI without separate test framework plumbing.
-- =============================================

BEGIN ISOLATION LEVEL REPEATABLE READ;

DO $$
DECLARE
  policy_roles text;
  policy_expr  text;
  anon_count   int;
  auth_count   int;
BEGIN
  -- --------------------------------------------------------
  -- 1. Policy shape: lives on categories, applies to BOTH
  --    anon and authenticated, filters on is_active = true.
  -- --------------------------------------------------------
  SELECT
    array_to_string(polroles::regrole[]::text[], ','),
    pg_get_expr(polqual, polrelid)
    INTO policy_roles, policy_expr
  FROM pg_policy
  WHERE polrelid = 'public.categories'::regclass
    AND polname  = 'categories_public_read';

  IF policy_roles IS NULL THEN
    RAISE EXCEPTION
      'categories_public_read policy missing on public.categories';
  END IF;

  IF policy_roles NOT LIKE '%anon%'
     OR policy_roles NOT LIKE '%authenticated%' THEN
    RAISE EXCEPTION
      'categories_public_read must apply to {anon, authenticated}, found %',
      policy_roles;
  END IF;

  IF policy_expr NOT LIKE '%is_active%' THEN
    RAISE EXCEPTION
      'categories_public_read must keep the (is_active = true) filter, found %',
      policy_expr;
  END IF;

  -- --------------------------------------------------------
  -- 2. Behaviour: anon and authenticated see the same active
  --    rows for every merchant. Compare COUNT under each role.
  -- --------------------------------------------------------
  SET LOCAL ROLE anon;
  SELECT COUNT(*) INTO anon_count
  FROM public.categories
  WHERE is_active = true;
  RESET ROLE;

  SET LOCAL ROLE authenticated;
  SELECT COUNT(*) INTO auth_count
  FROM public.categories
  WHERE is_active = true;
  RESET ROLE;

  IF anon_count <> auth_count THEN
    RAISE EXCEPTION
      'anon and authenticated must see the same number of active categories. anon=%, authenticated=%',
      anon_count, auth_count;
  END IF;

  -- --------------------------------------------------------
  -- 3. Inactive rows stay hidden from both roles. We do not
  --    insert here (this script must be read-only safe to run
  --    against prod) but we assert the policy expression
  --    tightly excludes the inactive set.
  -- --------------------------------------------------------
  IF policy_expr <> '(is_active = true)' THEN
    RAISE EXCEPTION
      'categories_public_read using_expr must equal "(is_active = true)" exactly, found %',
      policy_expr;
  END IF;

  RAISE NOTICE
    'OK: categories_public_read applies to {anon,authenticated}, filter (is_active = true), both roles see % active rows',
    anon_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;
