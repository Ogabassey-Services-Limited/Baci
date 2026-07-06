-- =============================================
-- REGRESSION TEST: customer username write guard
--   `public.customers` has table-level GRANT ALL to authenticated plus an
--   UPDATE RLS policy scoped to the caller's own row, so a shopper can write
--   `username` DIRECTLY via PostgREST and bypass set_customer_username. These
--   assertions ensure the BEFORE trigger re-applies the format + reserved rules
--   on every write path, and that the setter RPC rejects NULL (which would
--   otherwise silently clear an existing username).
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/customer_username_write_guard.sql
-- =============================================

BEGIN;

-- 1. The validation trigger must exist and fire BEFORE INSERT/UPDATE of the
--    username column, for each row, via validate_customer_username.
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

  IF trigger_def NOT LIKE '%FOR EACH ROW%'
    OR trigger_def NOT LIKE '%validate_customer_username%'
  THEN
    RAISE EXCEPTION
      'username trigger must run validate_customer_username per row, found %',
      trigger_def;
  END IF;
END $$;

-- 2. The trigger function must enforce the charset regex + reserved list and be
--    a hardened SECURITY DEFINER with an empty search_path.
DO $$
DECLARE
  fn_def text;
BEGIN
  fn_def := pg_get_functiondef('public.validate_customer_username()'::regprocedure);

  IF fn_def NOT LIKE '%reserved_usernames%' THEN
    RAISE EXCEPTION 'validate_customer_username must reject reserved names, found %', fn_def;
  END IF;

  IF fn_def NOT LIKE '%[a-z0-9][a-z0-9._]%' THEN
    RAISE EXCEPTION 'validate_customer_username must enforce the charset regex, found %', fn_def;
  END IF;

  IF fn_def NOT LIKE '%SECURITY DEFINER%'
    OR fn_def NOT LIKE '%search_path%'
  THEN
    RAISE EXCEPTION 'validate_customer_username must be SECURITY DEFINER with a pinned search_path, found %', fn_def;
  END IF;
END $$;

-- 3. The setter RPC must reject NULL up front so it cannot silently clear an
--    existing username.
DO $$
DECLARE
  fn_def text;
BEGIN
  fn_def := pg_get_functiondef('public.set_customer_username(uuid, text)'::regprocedure);

  IF fn_def NOT LIKE '%IS NULL OR v_norm = ''''%'
    AND fn_def NOT LIKE '%v_norm IS NULL%'
  THEN
    RAISE EXCEPTION 'set_customer_username must reject NULL/blank usernames, found %', fn_def;
  END IF;
END $$;

ROLLBACK;
