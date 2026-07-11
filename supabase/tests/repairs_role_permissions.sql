-- =============================================
-- VERIFICATION: repairs role_permissions seed + repairs table staff policies
--   Run against a Supabase branch after applying the repairs migrations.
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/repairs_role_permissions.sql
-- =============================================

BEGIN;

-- The repairs resource must be seeded for every default role.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'accountant', 'admin', 'blog_manager', 'customer_service',
    'fulfillment', 'inventory', 'manager', 'marketing', 'sales_rep'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.role_permissions
      WHERE role = r AND permissions ? 'repairs'
    ) THEN
      RAISE EXCEPTION 'role_permissions.% is missing the repairs resource', r;
    END IF;
  END LOOP;
END $$;

-- admin gets view + edit + delete.
DO $$
DECLARE
  perms jsonb;
BEGIN
  SELECT permissions -> 'repairs' INTO perms
  FROM public.role_permissions WHERE role = 'admin';

  IF (perms ->> 'view')::boolean IS NOT TRUE
    OR (perms ->> 'edit')::boolean IS NOT TRUE
    OR (perms ->> 'delete')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'admin must have repairs view/edit/delete, found %', perms;
  END IF;
END $$;

-- accountant is read-only: view but not edit/delete.
DO $$
DECLARE
  perms jsonb;
BEGIN
  SELECT permissions -> 'repairs' INTO perms
  FROM public.role_permissions WHERE role = 'accountant';

  IF (perms ->> 'view')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'accountant must have repairs.view, found %', perms;
  END IF;
  IF COALESCE((perms ->> 'edit')::boolean, false)
    OR COALESCE((perms ->> 'delete')::boolean, false) THEN
    RAISE EXCEPTION 'accountant must NOT have repairs edit/delete, found %', perms;
  END IF;
END $$;

-- blog_manager has no repairs access.
DO $$
DECLARE
  perms jsonb;
BEGIN
  SELECT permissions -> 'repairs' INTO perms
  FROM public.role_permissions WHERE role = 'blog_manager';

  IF COALESCE((perms ->> 'view')::boolean, false) THEN
    RAISE EXCEPTION 'blog_manager must NOT have repairs.view, found %', perms;
  END IF;
END $$;

-- The baseline owner-only repairs policies must be gone.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.repairs'::regclass
      AND polname IN (
        'Merchants can view store repairs',
        'Merchants can update store repairs',
        'Merchants can delete store repairs'
      )
  ) THEN
    RAISE EXCEPTION 'baseline owner-only repairs policies must be dropped';
  END IF;
END $$;

-- Staff policies on repairs must use check_staff_permission for the repairs resource.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT polname, pg_get_expr(coalesce(polqual, polwithcheck), polrelid) AS expr
    FROM pg_policy
    WHERE polrelid = 'public.repairs'::regclass
      AND polname LIKE 'repairs_staff_%'
  LOOP
    IF rec.expr NOT LIKE '%check_staff_permission%'
      OR rec.expr NOT LIKE '%repairs%'
    THEN
      RAISE EXCEPTION
        'repairs staff policy % must use check_staff_permission for repairs, found %',
        rec.polname, rec.expr;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.repairs'::regclass AND polname = 'repairs_staff_read'
  ) THEN
    RAISE EXCEPTION 'repairs_staff_read policy is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.repairs'::regclass AND polname = 'repairs_staff_update'
  ) THEN
    RAISE EXCEPTION 'repairs_staff_update policy is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.repairs'::regclass AND polname = 'repairs_staff_delete'
  ) THEN
    RAISE EXCEPTION 'repairs_staff_delete policy is missing';
  END IF;
END $$;

ROLLBACK;
