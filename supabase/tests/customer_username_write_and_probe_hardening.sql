-- =============================================
-- REGRESSION TEST: customer username write + probe hardening
--   Covers 20260707120000_customer_username_write_and_probe_hardening.sql:
--     1. The write guard trigger fires on NULL writes (no WHEN clause) and the
--        function rejects clearing an existing username via a direct write.
--     2. The availability probe excludes the caller's own row so re-checking
--        your current username reports "available".
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/customer_username_write_and_probe_hardening.sql
-- =============================================

BEGIN;

-- 1. The trigger must fire on every username write, including NULL, so a direct
--    `SET username = NULL` clear reaches the guard. That means NO `WHEN` clause.
DO $$
DECLARE
  trigger_def text;
BEGIN
  SELECT pg_get_triggerdef(t.oid)
  INTO trigger_def
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.customers'::regclass
    AND t.tgname = 'trg_validate_customer_username'
    AND NOT t.tgisinternal;

  IF trigger_def IS NULL THEN
    RAISE EXCEPTION 'trg_validate_customer_username trigger is missing on public.customers';
  END IF;

  IF trigger_def NOT LIKE '%BEFORE INSERT OR UPDATE OF username%' THEN
    RAISE EXCEPTION
      'username trigger must be BEFORE INSERT OR UPDATE OF username, found %',
      trigger_def;
  END IF;

  -- A WHEN (NEW.username IS NOT NULL) clause would skip the guard for NULL
  -- clears; it must be gone so the function itself decides.
  IF trigger_def LIKE '%WHEN %' THEN
    RAISE EXCEPTION
      'username trigger must not carry a WHEN clause (NULL clears must reach the guard), found %',
      trigger_def;
  END IF;
END $$;

-- 2. The trigger function must reject clearing an existing username on UPDATE.
DO $$
DECLARE
  fn_def text;
BEGIN
  fn_def := pg_get_functiondef('public.validate_customer_username()'::regprocedure);

  IF fn_def NOT LIKE '%OLD.username IS NOT NULL%'
    OR fn_def NOT LIKE '%TG_OP = ''UPDATE''%'
  THEN
    RAISE EXCEPTION
      'validate_customer_username must reject clearing an existing username on UPDATE, found %',
      fn_def;
  END IF;
END $$;

-- 3. The availability probe must exclude the caller's own row from the
--    collision check.
DO $$
DECLARE
  fn_def text;
BEGIN
  fn_def := pg_get_functiondef('public.is_customer_username_available(uuid, text)'::regprocedure);

  IF fn_def NOT LIKE '%IS DISTINCT FROM auth.uid()%' THEN
    RAISE EXCEPTION
      'is_customer_username_available must exclude the caller''s own row, found %',
      fn_def;
  END IF;

  -- Still format-guarded (regression against dropping the 110000 fix).
  IF fn_def NOT LIKE '%is_valid_username_format%' THEN
    RAISE EXCEPTION
      'is_customer_username_available must keep the format guard, found %',
      fn_def;
  END IF;
END $$;

ROLLBACK;
