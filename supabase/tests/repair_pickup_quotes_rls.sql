-- =============================================
-- VERIFICATION: repair_pickup_quotes RLS + grants (private table)
--   Run against a Supabase branch after applying the repairs migrations.
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/repair_pickup_quotes_rls.sql
-- =============================================

BEGIN;

-- RLS must be enabled.
DO $$
BEGIN
  IF NOT (
    SELECT relrowsecurity FROM pg_class
    WHERE oid = 'public.repair_pickup_quotes'::regclass
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.repair_pickup_quotes';
  END IF;
END $$;

-- anon must have ZERO table privileges (private pickup PII).
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.repair_pickup_quotes', 'SELECT') THEN
    RAISE EXCEPTION 'anon must NOT have SELECT on repair_pickup_quotes';
  END IF;
  IF has_table_privilege('anon', 'public.repair_pickup_quotes', 'INSERT') THEN
    RAISE EXCEPTION 'anon must NOT have INSERT on repair_pickup_quotes';
  END IF;
  IF has_column_privilege('anon', 'public.repair_pickup_quotes', 'quote_request', 'SELECT') THEN
    RAISE EXCEPTION 'anon must NOT be able to read repair_pickup_quotes.quote_request (pickup PII)';
  END IF;
END $$;

-- Every policy must gate on check_staff_permission for the repairs resource.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT polname, pg_get_expr(coalesce(polqual, polwithcheck), polrelid) AS expr
    FROM pg_policy
    WHERE polrelid = 'public.repair_pickup_quotes'::regclass
  LOOP
    IF rec.expr NOT LIKE '%check_staff_permission%'
      OR rec.expr NOT LIKE '%repairs%'
    THEN
      RAISE EXCEPTION
        'Policy % must use check_staff_permission for the repairs resource, found %',
        rec.polname, rec.expr;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.repair_pickup_quotes'::regclass
  ) THEN
    RAISE EXCEPTION 'repair_pickup_quotes has no RLS policies';
  END IF;
END $$;

-- shipments.order_id must be nullable so repair courier pickups can be stored.
DO $$
BEGIN
  IF (
    SELECT attnotnull FROM pg_attribute
    WHERE attrelid = 'public.shipments'::regclass
      AND attname = 'order_id'
  ) THEN
    RAISE EXCEPTION 'shipments.order_id must be nullable for repair pickups';
  END IF;
END $$;

ROLLBACK;
