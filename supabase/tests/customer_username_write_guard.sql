-- =============================================
-- REGRESSION TEST: customer username write guard (functional)
--   `public.customers` has table-level GRANT ALL to authenticated plus an
--   UPDATE RLS policy scoped to the caller's own row, so a shopper can write
--   `username` DIRECTLY via PostgREST and bypass set_customer_username. These
--   assertions exercise the BEFORE trigger's actual BEHAVIOR — a direct write of
--   an invalid or reserved username must be rejected, a valid one accepted and
--   trimmed — so the test stays correct regardless of whether the format rule is
--   inlined or delegated to is_valid_username_format().
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/customer_username_write_guard.sql
-- =============================================

BEGIN;

-- 1. Structural: the trigger fires BEFORE INSERT/UPDATE OF username, per row.
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
  IF trigger_def NOT LIKE '%BEFORE INSERT OR UPDATE OF username%'
    OR trigger_def NOT LIKE '%FOR EACH ROW%'
    OR trigger_def NOT LIKE '%validate_customer_username%'
  THEN
    RAISE EXCEPTION 'username trigger wiring is wrong, found %', trigger_def;
  END IF;
END $$;

-- 2. Functional: a direct UPDATE (the PostgREST bypass path) must be REJECTED
--    for reserved and malformed usernames, and ACCEPTED + trimmed for a valid
--    one. Uses a throwaway customer row (rolled back).
DO $$
DECLARE
  v_id uuid;
  v_stored text;
BEGIN
  INSERT INTO public.customers DEFAULT VALUES RETURNING id INTO v_id;

  -- reserved
  BEGIN
    UPDATE public.customers SET username = 'admin' WHERE id = v_id;
    RAISE EXCEPTION 'direct UPDATE to a reserved username was NOT rejected';
  EXCEPTION WHEN sqlstate '22023' THEN NULL; END;

  -- invalid charset
  BEGIN
    UPDATE public.customers SET username = 'bad!name' WHERE id = v_id;
    RAISE EXCEPTION 'direct UPDATE to an invalid-charset username was NOT rejected';
  EXCEPTION WHEN sqlstate '22023' THEN NULL; END;

  -- too short
  BEGIN
    UPDATE public.customers SET username = 'ab' WHERE id = v_id;
    RAISE EXCEPTION 'direct UPDATE to a too-short username was NOT rejected';
  EXCEPTION WHEN sqlstate '22023' THEN NULL; END;

  -- consecutive separators
  BEGIN
    UPDATE public.customers SET username = 'a..b' WHERE id = v_id;
    RAISE EXCEPTION 'direct UPDATE to a consecutive-separator username was NOT rejected';
  EXCEPTION WHEN sqlstate '22023' THEN NULL; END;

  -- valid: accepted and trimmed
  UPDATE public.customers SET username = '  CoolGamer99  ' WHERE id = v_id;
  SELECT username INTO v_stored FROM public.customers WHERE id = v_id;
  IF v_stored <> 'CoolGamer99' THEN
    RAISE EXCEPTION 'valid username should be stored trimmed, got %', v_stored;
  END IF;
END $$;

-- 3. Functional: the shared predicate the setter/trigger rely on returns FALSE
--    for NULL/blank (so a NULL can never silently clear a username).
DO $$
BEGIN
  IF public.is_valid_username_format(NULL) THEN
    RAISE EXCEPTION 'is_valid_username_format(NULL) must be false';
  END IF;
  IF public.is_valid_username_format('   ') THEN
    RAISE EXCEPTION 'is_valid_username_format(blank) must be false';
  END IF;
  IF NOT public.is_valid_username_format('oga_fan') THEN
    RAISE EXCEPTION 'is_valid_username_format should accept a valid username';
  END IF;
END $$;

ROLLBACK;
