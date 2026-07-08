-- =============================================
-- REGRESSION TEST: username availability probe honours the format rule
--   `is_customer_username_available` previously skipped the charset/length
--   check, so it reported malformed values (too short, leading/trailing or
--   doubled separators, spaces) as available even though `set_customer_username`
--   would reject them. These assertions pin the shared `is_valid_username_format`
--   predicate and prove the probe now depends on it.
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/customer_username_availability_format.sql
-- =============================================

BEGIN;

-- 1. The shared format predicate accepts well-formed usernames.
DO $$
BEGIN
  IF NOT public.is_valid_username_format('ogafan') THEN
    RAISE EXCEPTION 'expected "ogafan" to be a valid username format';
  END IF;
  IF NOT public.is_valid_username_format('a.b_c9') THEN
    RAISE EXCEPTION 'expected "a.b_c9" to be a valid username format';
  END IF;
  -- Casing/whitespace are normalized before matching.
  IF NOT public.is_valid_username_format('  OgaFan  ') THEN
    RAISE EXCEPTION 'expected padded/mixed-case "OgaFan" to be valid after normalize';
  END IF;
END;
$$;

-- 2. The shared format predicate rejects every malformed shape and NULL/blank.
DO $$
DECLARE
  bad text;
  bad_values text[] := ARRAY[
    'ab',                    -- too short (< 3)
    '_bad',                  -- leading separator
    'bad_',                  -- trailing separator
    'a..b',                  -- consecutive separators
    'a__b',                  -- consecutive separators
    'has space',             -- space is not allowed
    'waytoolongusername1234' -- > 20 chars
  ];
BEGIN
  IF public.is_valid_username_format(NULL) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'expected NULL username to be invalid (false), never TRUE/NULL';
  END IF;
  IF public.is_valid_username_format('') THEN
    RAISE EXCEPTION 'expected empty username to be invalid';
  END IF;
  FOREACH bad IN ARRAY bad_values LOOP
    IF public.is_valid_username_format(bad) THEN
      RAISE EXCEPTION 'expected "%" to be an invalid username format', bad;
    END IF;
  END LOOP;
END;
$$;

-- 3. The availability probe must depend on the shared format predicate, so it
--    can never report a malformed (un-settable) username as available.
DO $$
DECLARE
  fn_def text;
BEGIN
  SELECT pg_get_functiondef('public.is_customer_username_available(uuid, text)'::regprocedure)
  INTO fn_def;

  IF fn_def NOT LIKE '%is_valid_username_format%' THEN
    RAISE EXCEPTION
      'is_customer_username_available must call is_valid_username_format, found %',
      fn_def;
  END IF;
END;
$$;

ROLLBACK;
