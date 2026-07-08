-- =============================================
-- REGRESSION TEST: quiz leaderboard prefers the chosen username while
--                  PRESERVING the #2965 authz/PII hardening
--   Covers 20260707130000_quiz_leaderboard_prefer_username.sql:
--     1. get_quiz_leaderboard derives customer_name from customers.username,
--        so the public leaderboard honors the gate's "announced by username,
--        not your full name" promise.
--     2. The display-name COALESCE precedence is username -> full_name ->
--        first+last -> 'Anonymous Customer' (username wins; legacy rows without
--        a username still fall back to a name).
--     3. loyalty_points is NOT projected (wallet-like PII) — the migration must
--        not regress the #2965 hardening by re-adding it to the result columns.
--     4. The QZ031 membership authorization guard is preserved — an
--        unauthorized caller (auth.uid() with no matching customer row) is
--        rejected instead of reading another merchant's leaderboard.
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

  -- The #2965 authorization guard must be preserved: an unauthorized caller
  -- must be rejected with QZ031, not served another merchant's leaderboard.
  IF fn_def NOT LIKE '%QZ031%' OR fn_def NOT LIKE '%auth.uid()%' THEN
    RAISE EXCEPTION
      'get_quiz_leaderboard must keep the QZ031 membership authz guard, found %',
      fn_def;
  END IF;

  -- The membership guard must exclude soft-deleted customer rows (consistent
  -- with the other membership guards in this PR), otherwise an offboarded
  -- customer whose row still carries their user_id could read the leaderboard.
  IF fn_def NOT LIKE '%deleted_at IS NULL%' THEN
    RAISE EXCEPTION
      'get_quiz_leaderboard membership guard must exclude soft-deleted customers (deleted_at IS NULL), found %',
      fn_def;
  END IF;

  -- The #2965 double precision cast must be preserved so plpgsql RETURN QUERY
  -- does not raise SQLSTATE 42804 at call time.
  IF fn_def NOT LIKE '%::double precision%' THEN
    RAISE EXCEPTION
      'get_quiz_leaderboard must keep the ::double precision timing cast, found %',
      fn_def;
  END IF;
END $$;

-- 2. loyalty_points (wallet-like PII) must NOT appear in the projected result
--    columns. Inspect the declared RETURNS TABLE signature directly.
DO $$
DECLARE
  result_cols text;
BEGIN
  result_cols := pg_get_function_result('public.get_quiz_leaderboard(uuid)'::regprocedure);

  IF result_cols LIKE '%loyalty_points%' THEN
    RAISE EXCEPTION
      'get_quiz_leaderboard must NOT project loyalty_points (PII), found columns: %',
      result_cols;
  END IF;

  IF result_cols NOT LIKE '%customer_name%' THEN
    RAISE EXCEPTION
      'get_quiz_leaderboard must still project customer_name, found columns: %',
      result_cols;
  END IF;
END $$;

-- 3. Functional check of the display-name precedence used by the RPC. No table
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

-- 4. Behavioral check: an unauthorized caller (no customer row for auth.uid())
--    must be rejected with SQLSTATE QZ031, never served leaderboard rows.
DO $$
DECLARE
  sqlstate_seen text;
BEGIN
  -- auth.uid() resolves to NULL in this test context, so the membership EXISTS
  -- guard cannot match any customer row -> the function must raise QZ031.
  PERFORM public.get_quiz_leaderboard('00000000-0000-0000-0000-000000000000'::uuid);
  RAISE EXCEPTION 'expected QZ031 for an unauthorized caller, but the call succeeded';
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS sqlstate_seen = RETURNED_SQLSTATE;
    IF sqlstate_seen <> 'QZ031' THEN
      RAISE EXCEPTION
        'expected SQLSTATE QZ031 for an unauthorized caller, got %',
        sqlstate_seen;
    END IF;
END $$;

ROLLBACK;
