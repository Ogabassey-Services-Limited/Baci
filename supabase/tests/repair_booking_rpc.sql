-- =============================================
-- VERIFICATION: repair booking RPC ACL + repairs anon hardening
--   Run against a Supabase branch after applying the repairs migrations.
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/repair_booking_rpc.sql
-- =============================================

BEGIN;

-- Public wrapper: SECURITY INVOKER, anon + authenticated can EXECUTE.
DO $$
DECLARE
  is_definer boolean;
BEGIN
  SELECT prosecdef INTO is_definer
  FROM pg_proc
  WHERE oid = 'public.create_repair_booking(uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid)'::regprocedure;

  IF is_definer IS NOT FALSE THEN
    RAISE EXCEPTION 'public.create_repair_booking must be SECURITY INVOKER';
  END IF;

  IF NOT has_function_privilege('anon',
    'public.create_repair_booking(uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid)',
    'EXECUTE') THEN
    RAISE EXCEPTION 'anon must have EXECUTE on public.create_repair_booking';
  END IF;

  IF NOT has_function_privilege('authenticated',
    'public.create_repair_booking(uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid)',
    'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must have EXECUTE on public.create_repair_booking';
  END IF;
END $$;

-- Private fn: SECURITY DEFINER, empty search_path, anon can EXECUTE (invoker wrapper).
DO $$
DECLARE
  is_definer boolean;
  config text[];
BEGIN
  SELECT prosecdef, proconfig
  INTO is_definer, config
  FROM pg_proc
  WHERE oid = 'private.create_repair_booking(uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid)'::regprocedure;

  IF is_definer IS NOT TRUE THEN
    RAISE EXCEPTION 'private.create_repair_booking must be SECURITY DEFINER';
  END IF;
  -- proconfig serializes an empty search_path as search_path= or search_path=""
  IF config IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(config) AS entry
    WHERE entry LIKE 'search_path=%'
      AND trim(both '"' from split_part(entry, '=', 2)) = ''
  ) THEN
    RAISE EXCEPTION 'private.create_repair_booking must SET search_path = ''''';
  END IF;

  IF NOT has_function_privilege('anon',
    'private.create_repair_booking(uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid)',
    'EXECUTE') THEN
    RAISE EXCEPTION 'anon must have EXECUTE on private.create_repair_booking (invoker wrapper)';
  END IF;
END $$;

-- Anon must have NO direct DML on repairs and the public INSERT policy must be gone.
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.repairs', 'INSERT') THEN
    RAISE EXCEPTION 'anon must NOT have INSERT on public.repairs after hardening';
  END IF;
  IF has_table_privilege('anon', 'public.repairs', 'SELECT') THEN
    RAISE EXCEPTION 'anon must NOT have SELECT on public.repairs after hardening';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.repairs'::regclass
      AND polname = 'Public can create repair requests'
  ) THEN
    RAISE EXCEPTION 'the public repairs INSERT policy must be dropped';
  END IF;
END $$;

ROLLBACK;
