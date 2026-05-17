-- =============================================
-- REGRESSION TEST: merchant slug immutability
--   Validates 20260517200500_lock_established_merchant_slugs.sql.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/merchant_slug_immutability.sql
--   or via Supabase MCP execute_sql
--
-- This script mutates merchants inside a transaction and rolls back. It proves
-- that an established slug cannot be changed or cleared, while a pending
-- merchant can still receive its initial generated slug.
-- =============================================

BEGIN;

DO $$
DECLARE
  cleared_message text;
  changed_message text;
  generated_slug text;
  insecure_function text;
  missing_trigger text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = 'public.prevent_established_merchant_slug_change()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'merchant slug immutability function missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'zz_prevent_established_merchant_slug_change'
      AND tgrelid = 'public.merchants'::regclass
      AND NOT tgisinternal
  ) THEN
    missing_trigger := 'zz_prevent_established_merchant_slug_change';
  END IF;

  IF missing_trigger IS NOT NULL THEN
    RAISE EXCEPTION 'merchant slug immutability trigger missing: %', missing_trigger;
  END IF;

  SELECT 'public.prevent_established_merchant_slug_change()'
  INTO insecure_function
  WHERE has_function_privilege('PUBLIC', 'public.prevent_established_merchant_slug_change()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.prevent_established_merchant_slug_change()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.prevent_established_merchant_slug_change()', 'EXECUTE');

  IF insecure_function IS NOT NULL THEN
    RAISE EXCEPTION 'trigger helper % must not grant EXECUTE to PUBLIC, anon, or authenticated', insecure_function;
  END IF;

  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    '8f0ed783-0000-4000-8000-000000000201',
    'slug-lock@example.com',
    'Slug Lock Store',
    'slug-lock-store'
  );

  UPDATE public.merchants
  SET business_name = 'Slug Lock Store Renamed'
  WHERE id = '8f0ed783-0000-4000-8000-000000000201';

  IF (
    SELECT slug
    FROM public.merchants
    WHERE id = '8f0ed783-0000-4000-8000-000000000201'
  ) <> 'slug-lock-store' THEN
    RAISE EXCEPTION 'business_name update changed established merchant slug';
  END IF;

  BEGIN
    UPDATE public.merchants
    SET slug = 'changed-slug'
    WHERE id = '8f0ed783-0000-4000-8000-000000000201';

    RAISE EXCEPTION 'changing an established merchant slug unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS changed_message = MESSAGE_TEXT;
  END;

  IF changed_message <> 'merchant_slug_immutable' THEN
    RAISE EXCEPTION 'unexpected established slug change error: %', changed_message;
  END IF;

  BEGIN
    UPDATE public.merchants
    SET slug = NULL
    WHERE id = '8f0ed783-0000-4000-8000-000000000201';

    RAISE EXCEPTION 'clearing an established merchant slug unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS cleared_message = MESSAGE_TEXT;
  END;

  IF cleared_message <> 'merchant_slug_immutable' THEN
    RAISE EXCEPTION 'unexpected established slug clear error: %', cleared_message;
  END IF;

  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    '8f0ed783-0000-4000-8000-000000000202',
    'slug-initial-assignment@example.com',
    NULL,
    NULL
  );

  UPDATE public.merchants
  SET business_name = 'Initial Assignment Store'
  WHERE id = '8f0ed783-0000-4000-8000-000000000202';

  SELECT slug
  INTO generated_slug
  FROM public.merchants
  WHERE id = '8f0ed783-0000-4000-8000-000000000202';

  IF generated_slug IS NULL OR btrim(generated_slug) = '' THEN
    RAISE EXCEPTION 'pending merchant did not receive initial generated slug';
  END IF;

  RAISE NOTICE 'OK: merchant slug immutability is enforced';
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
