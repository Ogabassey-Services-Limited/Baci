-- The pre-cleanup archive must preserve malformed tenant edges without making
-- historic membership data readable through the public Data API.
BEGIN;

DO $$
DECLARE
  v_archive_table regclass := 'public.product_category_cross_tenant_archive';
  v_row_security boolean;
  v_force_row_security boolean;
BEGIN
  SELECT class.relrowsecurity, class.relforcerowsecurity
  INTO v_row_security, v_force_row_security
  FROM pg_class AS class
  WHERE class.oid = v_archive_table;

  IF NOT v_row_security OR NOT v_force_row_security THEN
    RAISE EXCEPTION 'cross-tenant membership archive must enforce RLS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_category_cross_tenant_archive'
  ) THEN
    RAISE EXCEPTION 'cross-tenant membership archive must not expose policies';
  END IF;

  IF has_table_privilege('anon', v_archive_table, 'SELECT')
    OR has_table_privilege('authenticated', v_archive_table, 'SELECT')
    OR has_table_privilege('service_role', v_archive_table, 'SELECT') THEN
    RAISE EXCEPTION 'cross-tenant membership archive must not be publicly readable';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.product_category_cross_tenant_archive AS archive
    WHERE archive.membership_id = 'a4000000-0000-4000-8000-000000000001'
      AND archive.product_id = 'a2000000-0000-4000-8000-000000000001'
      AND archive.category_id = 'a3000000-0000-4000-8000-000000000001'
      AND archive.product_merchant_id = 'a1000000-0000-4000-8000-000000000001'
      AND archive.category_merchant_id = 'a1000000-0000-4000-8000-000000000002'
  ) THEN
    RAISE EXCEPTION 'legacy cross-tenant membership must be archived before cleanup';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.product_categories
    WHERE id = 'a4000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'archive migration must leave cleanup to the next migration';
  END IF;
END;
$$;

ROLLBACK;
