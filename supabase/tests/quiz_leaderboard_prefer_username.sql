-- =============================================
-- REGRESSION TEST: quiz leaderboard prefers the chosen username
--   Covers 20260707130000_quiz_leaderboard_prefer_username.sql:
--     1. get_quiz_leaderboard derives customer_name from customers.username,
--        so the public leaderboard honors the gate's "announced by username,
--        not your full name" promise.
--     2. The display-name COALESCE precedence is username -> full_name ->
--        first+last -> 'Anonymous Customer' (username wins; legacy rows without
--        a username still fall back to a name).
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/quiz_leaderboard_prefer_username.sql
-- =============================================

BEGIN;

-- 1. The leaderboard RPC must reference customers.username so the display name
--    can prefer it. (Guards against the RPC drifting back to a full-name-only
--    derivation that would expose real names on the public leaderboard.)
DO $$
DECLARE
  fn_def text;
BEGIN
  fn_def := pg_get_functiondef('public.get_quiz_leaderboard(uuid)'::regprocedure);

  IF fn_def NOT LIKE '%c.username%' THEN
    RAISE EXCEPTION
      'get_quiz_leaderboard must derive customer_name from c.username, found %',
      fn_def;
  END IF;

  -- username must be preferred over the full name: its btrim/NULLIF must appear
  -- before the full_name btrim in the COALESCE chain.
  IF position('btrim(c.username)' IN fn_def) = 0
    OR position('btrim(c.username)' IN fn_def)
       > position('btrim(c.full_name)' IN fn_def)
  THEN
    RAISE EXCEPTION
      'get_quiz_leaderboard must prefer c.username ahead of c.full_name, found %',
      fn_def;
  END IF;
END $$;

-- 2. Functional check of the display-name precedence used by the RPC. No table
--    seeding required: exercise the exact COALESCE expression with literals.
DO $$
BEGIN
  -- username wins when present.
  ASSERT (
    SELECT COALESCE(
      NULLIF(pg_catalog.btrim('ogafan'::text), ''),
      NULLIF(pg_catalog.btrim('Full Name'::text), ''),
      COALESCE(pg_catalog.btrim(NULLIF(concat_ws(' ', 'First'::text, 'Last'::text), '')), 'Anonymous Customer')
    )
  ) = 'ogafan', 'username must be preferred when set';

  -- blank/NULL username falls back to full_name.
  ASSERT (
    SELECT COALESCE(
      NULLIF(pg_catalog.btrim(NULL::text), ''),
      NULLIF(pg_catalog.btrim('Full Name'::text), ''),
      COALESCE(pg_catalog.btrim(NULLIF(concat_ws(' ', 'First'::text, 'Last'::text), '')), 'Anonymous Customer')
    )
  ) = 'Full Name', 'blank username must fall back to full_name';

  -- no username and no full name falls back to first+last.
  ASSERT (
    SELECT COALESCE(
      NULLIF(pg_catalog.btrim(NULL::text), ''),
      NULLIF(pg_catalog.btrim(NULL::text), ''),
      COALESCE(pg_catalog.btrim(NULLIF(concat_ws(' ', 'First'::text, 'Last'::text), '')), 'Anonymous Customer')
    )
  ) = 'First Last', 'missing names must fall back to first+last';

  -- nothing set falls back to the anonymous sentinel.
  ASSERT (
    SELECT COALESCE(
      NULLIF(pg_catalog.btrim(NULL::text), ''),
      NULLIF(pg_catalog.btrim(NULL::text), ''),
      COALESCE(pg_catalog.btrim(NULLIF(concat_ws(' ', NULL::text, NULL::text), '')), 'Anonymous Customer')
    )
  ) = 'Anonymous Customer', 'empty row must fall back to Anonymous Customer';
END $$;

ROLLBACK;
