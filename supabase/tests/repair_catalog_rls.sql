-- =============================================
-- VERIFICATION: repairs catalogue RLS + grants
--   Run against a Supabase branch after applying the repairs migrations.
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/repair_catalog_rls.sql
-- =============================================

BEGIN;

-- RLS must be enabled on all three catalogue tables.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'repair_service_types', 'repair_devices', 'repair_quotes'
  ] LOOP
    IF NOT (
      SELECT relrowsecurity FROM pg_class
      WHERE oid = ('public.' || t)::regclass
    ) THEN
      RAISE EXCEPTION 'RLS is not enabled on public.%', t;
    END IF;
  END LOOP;
END $$;

-- Public read policies must gate on is_active AND the feature helper.
DO $$
DECLARE
  t text;
  using_expr text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'repair_service_types', 'repair_devices', 'repair_quotes'
  ] LOOP
    SELECT pg_get_expr(polqual, polrelid)
    INTO using_expr
    FROM pg_policy
    WHERE polrelid = ('public.' || t)::regclass
      AND polname = t || '_public_read';

    IF using_expr IS NULL THEN
      RAISE EXCEPTION 'Missing public read policy on public.%', t;
    END IF;

    IF using_expr NOT LIKE '%is_active%'
      OR using_expr NOT LIKE '%repairs_catalog_publicly_enabled%'
    THEN
      RAISE EXCEPTION
        'Public read policy on public.% must gate on is_active AND the feature helper, found %',
        t, using_expr;
    END IF;
  END LOOP;
END $$;

-- Staff write policies must use check_staff_permission with the repairs resource.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT polname, pg_get_expr(coalesce(polqual, polwithcheck), polrelid) AS expr
    FROM pg_policy
    WHERE polrelid = 'public.repair_quotes'::regclass
      AND polname LIKE '%_staff_%'
  LOOP
    IF rec.expr NOT LIKE '%check_staff_permission%'
      OR rec.expr NOT LIKE '%repairs%'
    THEN
      RAISE EXCEPTION
        'Staff policy % must use check_staff_permission for the repairs resource, found %',
        rec.polname, rec.expr;
    END IF;
  END LOOP;
END $$;

-- Column-scoped SELECT grants: price readable, internal_notes NOT readable by
-- anon OR authenticated.
DO $$
BEGIN
  IF NOT has_column_privilege('anon', 'public.repair_quotes', 'price', 'SELECT') THEN
    RAISE EXCEPTION 'anon should be able to SELECT repair_quotes.price';
  END IF;
  IF has_column_privilege('anon', 'public.repair_quotes', 'internal_notes', 'SELECT') THEN
    RAISE EXCEPTION 'anon must NOT be able to SELECT repair_quotes.internal_notes';
  END IF;
  IF has_column_privilege('authenticated', 'public.repair_quotes', 'internal_notes', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated must NOT be able to SELECT repair_quotes.internal_notes';
  END IF;
END $$;

-- Feature helper must be SECURITY DEFINER and normalize electronics + gadgets.
DO $$
DECLARE
  is_definer boolean;
  body text;
BEGIN
  SELECT prosecdef, prosrc
  INTO is_definer, body
  FROM pg_proc
  WHERE oid = 'public.repairs_catalog_publicly_enabled(uuid)'::regprocedure;

  IF is_definer IS NOT TRUE THEN
    RAISE EXCEPTION 'repairs_catalog_publicly_enabled must be SECURITY DEFINER';
  END IF;
  IF body NOT LIKE '%electronics%' OR body NOT LIKE '%gadgets%' THEN
    RAISE EXCEPTION 'repairs_catalog_publicly_enabled must normalize electronics AND gadgets';
  END IF;
END $$;

ROLLBACK;
