-- =============================================
-- REGRESSION TEST: business_address derivation from registered_address
--   Validates
--   20260617000200_derive_business_address_from_registered_address.sql (PR-F).
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/business_address_derivation.sql
--   or via Supabase MCP execute_sql
--
-- This script mutates merchants inside a transaction and ROLLS BACK. It proves:
--   1. the format function + sync trigger exist and are not PUBLIC-executable;
--   2. inserting a structured registered_address derives business_address;
--   3. editing registered_address re-derives business_address;
--   4. clearing registered_address NULLs business_address (no stale value);
--   5. format_merchant_address output parity with the documented contract;
--   6. an authenticated client can update registered_address and have the
--      trigger derive business_address (the SECURITY DEFINER trigger resolves the
--      EXECUTE-revoked formatter against the owner, not the caller);
--   7. the one-time back-fill PRESERVES legacy free-text-only addresses (rows
--      whose registered_address is still `{}`) instead of nulling them.
-- =============================================

BEGIN;

DO $$
DECLARE
  derived text;
  insecure_function text;
BEGIN
  -- 1. function + trigger present
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = 'public.format_merchant_address(jsonb)'::regprocedure
  ) THEN
    RAISE EXCEPTION 'format_merchant_address(jsonb) function missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = 'public.sync_business_address_from_registered()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'sync_business_address_from_registered() function missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'zz_sync_business_address_from_registered'
      AND tgrelid = 'public.merchants'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'business_address sync trigger missing';
  END IF;

  -- The formatter must not be EXECUTE-able by anon/authenticated, and must not
  -- carry a PUBLIC (empty-grantee) EXECUTE grant in its ACL. (We inspect proacl
  -- directly for the PUBLIC case: has_function_privilege() rejects the literal
  -- role name 'PUBLIC'.)
  SELECT 'public.format_merchant_address(jsonb)'
  INTO insecure_function
  WHERE has_function_privilege('anon', 'public.format_merchant_address(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.format_merchant_address(jsonb)', 'EXECUTE')
     OR EXISTS (
       SELECT 1
       FROM pg_proc p,
            LATERAL aclexplode(p.proacl) AS acl
       WHERE p.oid = 'public.format_merchant_address(jsonb)'::regprocedure
         AND acl.grantee = 0 -- 0 = PUBLIC pseudo-role
         AND acl.privilege_type = 'EXECUTE'
     );

  IF insecure_function IS NOT NULL THEN
    RAISE EXCEPTION 'helper % must not grant EXECUTE to PUBLIC, anon, or authenticated', insecure_function;
  END IF;

  -- 2. INSERT with a structured address derives business_address
  INSERT INTO public.merchants (id, email, business_name, slug, registered_address)
  VALUES (
    '8f0ed783-0000-4000-8000-0000000003f1',
    'address-derive@example.com',
    'Address Derive Store',
    'address-derive-store',
    jsonb_build_object(
      'street', '12 Allen Avenue',
      'city', 'Ikeja',
      'state', 'Lagos',
      'postal_code', '100271',
      'country', 'Nigeria'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT business_address
  INTO derived
  FROM public.merchants
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f1';

  IF derived IS DISTINCT FROM '12 Allen Avenue, Ikeja, Lagos, 100271' THEN
    RAISE EXCEPTION 'insert did not derive business_address, got: %', COALESCE(derived, '<null>');
  END IF;

  -- 3. editing registered_address re-derives business_address
  UPDATE public.merchants
  SET registered_address = jsonb_build_object(
    'street', '7 Marina Road',
    'city', 'Lagos Island'
  )
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f1';

  SELECT business_address
  INTO derived
  FROM public.merchants
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f1';

  IF derived IS DISTINCT FROM '7 Marina Road, Lagos Island' THEN
    RAISE EXCEPTION 'edit did not re-derive business_address, got: %', COALESCE(derived, '<null>');
  END IF;

  -- 3b. a direct write to business_address is OVERWRITTEN by the derivation
  --     (proves business_address is derived, not independently writable)
  UPDATE public.merchants
  SET business_address = 'STALE 456 Oak Avenue',
      registered_address = jsonb_build_object('street', '9 Awolowo Way', 'city', 'Ikoyi')
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f1';

  SELECT business_address
  INTO derived
  FROM public.merchants
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f1';

  IF derived IS DISTINCT FROM '9 Awolowo Way, Ikoyi' THEN
    RAISE EXCEPTION 'direct business_address write was not overwritten by derivation, got: %', COALESCE(derived, '<null>');
  END IF;

  -- 3c. a direct write to business_address alone is also overwritten.
  UPDATE public.merchants
  SET business_address = 'STALE ONLY WRITE'
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f1';

  SELECT business_address
  INTO derived
  FROM public.merchants
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f1';

  IF derived IS DISTINCT FROM '9 Awolowo Way, Ikoyi' THEN
    RAISE EXCEPTION 'direct business_address-only write was not overwritten, got: %', COALESCE(derived, '<null>');
  END IF;

  -- 4. clearing registered_address NULLs business_address (no stale value)
  UPDATE public.merchants
  SET registered_address = '{}'::jsonb
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f1';

  SELECT business_address
  INTO derived
  FROM public.merchants
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f1';

  IF derived IS NOT NULL THEN
    RAISE EXCEPTION 'clearing registered_address left a stale business_address: %', derived;
  END IF;

  -- 4b. NULL registered_address also yields NULL business_address
  UPDATE public.merchants
  SET registered_address = NULL
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f1';

  SELECT business_address
  INTO derived
  FROM public.merchants
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f1';

  IF derived IS NOT NULL THEN
    RAISE EXCEPTION 'null registered_address left a non-null business_address: %', derived;
  END IF;

  -- 5. direct function-level parity checks (mirror the shared TS helper)
  IF public.format_merchant_address(
       jsonb_build_object('street', '  7 Marina Road  ', 'city', '  Lagos Island  ')
     ) IS DISTINCT FROM '7 Marina Road, Lagos Island' THEN
    RAISE EXCEPTION 'format_merchant_address did not trim/join parts as expected';
  END IF;

  IF public.format_merchant_address('{}'::jsonb) IS NOT NULL THEN
    RAISE EXCEPTION 'format_merchant_address({}) must return NULL';
  END IF;

  IF public.format_merchant_address(NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'format_merchant_address(NULL) must return NULL';
  END IF;

  -- country must be ignored (parity with TS + invoice/footer readers)
  IF public.format_merchant_address(
       jsonb_build_object('street', '12 Allen Avenue', 'country', 'Nigeria')
     ) IS DISTINCT FROM '12 Allen Avenue' THEN
    RAISE EXCEPTION 'format_merchant_address must ignore the country part';
  END IF;

  RAISE NOTICE 'OK: business_address is derived from registered_address and clears to NULL';
END;
$$ LANGUAGE plpgsql;

-- 6. The trigger must work for an AUTHENTICATED client. The formatter has EXECUTE
--    revoked from authenticated; a SECURITY INVOKER trigger would fail with
--    "permission denied for function format_merchant_address". The SECURITY DEFINER
--    trigger resolves that nested call against the owner instead, so the update
--    succeeds and derives business_address. We grant a temporary permissive policy
--    so the row-level update reaches the trigger; everything rolls back.
DO $$
DECLARE
  derived text;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug, registered_address)
  VALUES (
    '8f0ed783-0000-4000-8000-0000000003f2',
    'authed-derive@example.com',
    'Authed Derive Store',
    'authed-derive-store',
    jsonb_build_object('street', '15 Broad Street', 'city', 'Lagos', 'state', 'Lagos')
  )
  ON CONFLICT (id) DO NOTHING;

  GRANT SELECT, INSERT, UPDATE ON public.merchants TO authenticated;
  CREATE POLICY zz_test_authed_all ON public.merchants
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

  SET LOCAL ROLE authenticated;
  UPDATE public.merchants
  SET registered_address = jsonb_build_object('street', '7 Marina Road', 'city', 'Lagos Island')
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f2';
  RESET ROLE;

  SELECT business_address
  INTO derived
  FROM public.merchants
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f2';

  IF derived IS DISTINCT FROM '7 Marina Road, Lagos Island' THEN
    RAISE EXCEPTION 'authenticated registered_address update did not derive business_address, got: %', COALESCE(derived, '<null>');
  END IF;

  DROP POLICY zz_test_authed_all ON public.merchants;
  RAISE NOTICE 'OK: authenticated client update derives business_address (SECURITY DEFINER trigger)';
END;
$$ LANGUAGE plpgsql;

-- 7. The one-time back-fill must NOT wipe a legacy free-text-only address: a
--    merchant whose address lives only in business_address while
--    registered_address is still `{}` keeps its value.
--
--    In production these legacy rows already exist when the migration runs, so the
--    back-fill (not the trigger) is what could touch them. To reproduce that exact
--    state we seed the at-risk rows with the sync trigger temporarily DISABLED
--    (the INSERT trigger would otherwise immediately re-derive business_address
--    from the empty registered_address, masking the back-fill behaviour we are
--    testing). We then re-enable the trigger and replay the migration's back-fill
--    statement verbatim.
DO $$
DECLARE
  preserved text;
  derived text;
BEGIN
  ALTER TABLE public.merchants DISABLE TRIGGER zz_sync_business_address_from_registered;

  -- (a) free-text-only legacy row (registered_address = '{}')
  INSERT INTO public.merchants (id, email, business_name, slug, business_address, registered_address)
  VALUES (
    '8f0ed783-0000-4000-8000-0000000003f3',
    'freetext-only@example.com',
    'FreeText Only Store',
    'freetext-only-store',
    '99 Legacy Street, Old Town',
    '{}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  -- (b) structured row with a stale free-text business_address
  INSERT INTO public.merchants (id, email, business_name, slug, business_address, registered_address)
  VALUES (
    '8f0ed783-0000-4000-8000-0000000003f4',
    'structured-backfill@example.com',
    'Structured Backfill Store',
    'structured-backfill-store',
    'STALE 1 Old Road',
    jsonb_build_object('street', '15 Broad Street', 'city', 'Lagos', 'state', 'Lagos')
  )
  ON CONFLICT (id) DO NOTHING;

  ALTER TABLE public.merchants ENABLE TRIGGER zz_sync_business_address_from_registered;

  -- Replay the migration's back-fill statement verbatim.
  UPDATE public.merchants
  SET business_address = public.format_merchant_address(registered_address)
  WHERE registered_address IS NOT NULL
    AND registered_address <> '{}'::jsonb
    AND public.format_merchant_address(registered_address) IS NOT NULL
    AND business_address IS DISTINCT FROM public.format_merchant_address(registered_address);

  SELECT business_address INTO preserved
  FROM public.merchants WHERE id = '8f0ed783-0000-4000-8000-0000000003f3';
  IF preserved IS DISTINCT FROM '99 Legacy Street, Old Town' THEN
    RAISE EXCEPTION 'back-fill wiped a free-text-only address (data loss), got: %', COALESCE(preserved, '<null>');
  END IF;

  SELECT business_address INTO derived
  FROM public.merchants WHERE id = '8f0ed783-0000-4000-8000-0000000003f4';
  IF derived IS DISTINCT FROM '15 Broad Street, Lagos, Lagos' THEN
    RAISE EXCEPTION 'back-fill did not derive structured address, got: %', COALESCE(derived, '<null>');
  END IF;

  RAISE NOTICE 'OK: back-fill preserves free-text-only addresses and derives structured ones';
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
