-- =============================================
-- REGRESSION TEST: branch scope foundation
--   Validates 20260430120000_branch_scope_foundation.sql.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/branch_scope_foundation.sql
--   or via Supabase MCP execute_sql
--
-- This script intentionally mutates inside a transaction and rolls back. It
-- assert-fails (RAISE EXCEPTION) on any branch integrity, audit, RLS, or RPC
-- deviation.
-- =============================================

BEGIN;

DO $$
DECLARE
  missing_column text;
  missing_trigger text;
  insecure_function text;
  policy_count integer;
  delete_policy_count integer;
BEGIN
  SELECT expected.column_name INTO missing_column
  FROM (
    VALUES
      ('orders.branch_id'),
      ('variant_inventory.branch_id'),
      ('expenses.branch_id')
  ) AS expected(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = split_part(expected.column_name, '.', 1)
      AND c.column_name = split_part(expected.column_name, '.', 2)
  )
  LIMIT 1;

  IF missing_column IS NOT NULL THEN
    RAISE EXCEPTION 'branch scope migration missing column %', missing_column;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branches_default_requires_active'
      AND conrelid = 'public.branches'::regclass
  ) THEN
    RAISE EXCEPTION 'branches_default_requires_active constraint missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class idx
    JOIN pg_index i ON i.indexrelid = idx.oid
    WHERE idx.relname = 'idx_branches_one_active_default_per_merchant'
      AND pg_get_expr(i.indpred, i.indrelid) ILIKE '%is_default%true%'
      AND pg_get_expr(i.indpred, i.indrelid) ILIKE '%active%true%'
  ) THEN
    RAISE EXCEPTION 'active default unique index missing or not partial on active defaults';
  END IF;

  SELECT expected.trigger_name INTO missing_trigger
  FROM (
    VALUES
      ('ensure_orders_branch_matches_merchant'),
      ('ensure_variant_inventory_branch_matches_merchant'),
      ('ensure_expenses_branch_matches_merchant'),
      ('prevent_branch_merchant_change'),
      ('ensure_branch_manager_matches_merchant'),
      ('ensure_single_default_branch'),
      ('audit_branch_mutation'),
      ('reject_direct_branch_active_update'),
      ('unassign_branch_terminals_on_deactivation'),
      ('enforce_active_default_branch')
  ) AS expected(trigger_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = expected.trigger_name
      AND NOT tgisinternal
  )
  LIMIT 1;

  IF missing_trigger IS NOT NULL THEN
    RAISE EXCEPTION 'branch scope migration missing trigger %', missing_trigger;
  END IF;

  SELECT expected.function_signature INTO insecure_function
  FROM (
    VALUES
      ('public.ensure_single_default_branch()'),
      ('public.ensure_branch_matches_merchant()'),
      ('public.prevent_branch_merchant_change()'),
      ('public.ensure_branch_manager_matches_merchant()'),
      ('public.audit_branch_mutation()'),
      ('public.reject_direct_branch_active_update()'),
      ('public.unassign_branch_terminals_on_deactivation()'),
      ('public.enforce_active_default_branch()'),
      ('public.backfill_branch_scope_for_single_active_branch(uuid, uuid)')
  ) AS expected(function_signature)
  WHERE has_function_privilege('PUBLIC', expected.function_signature, 'EXECUTE')
     OR has_function_privilege('anon', expected.function_signature, 'EXECUTE')
     OR has_function_privilege('authenticated', expected.function_signature, 'EXECUTE')
  LIMIT 1;

  IF insecure_function IS NOT NULL THEN
    RAISE EXCEPTION 'trigger helper % must not grant EXECUTE to PUBLIC, anon, or authenticated', insecure_function;
  END IF;

  IF has_function_privilege('PUBLIC', 'public.deactivate_branch(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.deactivate_branch(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'deactivate_branch(uuid) must not be executable by PUBLIC or anon';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.deactivate_branch(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'deactivate_branch(uuid) must be executable by authenticated';
  END IF;

  SELECT count(*) INTO policy_count
  FROM pg_policy
  WHERE polrelid = 'public.branches'::regclass
    AND polname IN (
      'Merchants can create branches',
      'Merchants can update own branches'
    );

  IF policy_count <> 2 THEN
    RAISE EXCEPTION 'branch insert/update policies missing, found %', policy_count;
  END IF;

  SELECT count(*) INTO delete_policy_count
  FROM pg_policy
  WHERE polrelid = 'public.branches'::regclass
    AND polcmd = 'd';

  IF delete_policy_count <> 0 THEN
    RAISE EXCEPTION 'branches must not expose authenticated hard-delete policies, found %', delete_policy_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
VALUES
  (
    '00000000-0000-4000-8000-00000000b101',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'branch-owner@example.com',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-00000000b102',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'branch-staff@example.com',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-00000000b103',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'branch-other-staff@example.com',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

INSERT INTO public.merchants (id, user_id, email, business_name, slug)
VALUES
  (
    '00000000-0000-4000-8000-00000000b201',
    '00000000-0000-4000-8000-00000000b101',
    'branch-owner@example.com',
    'Branch Scope Merchant',
    'branch-scope-merchant'
  ),
  (
    '00000000-0000-4000-8000-00000000b202',
    NULL,
    'other-branch-owner@example.com',
    'Other Branch Scope Merchant',
    'other-branch-scope-merchant'
  );

INSERT INTO public.staff_members (
  id,
  merchant_id,
  user_id,
  email,
  name,
  role,
  permissions,
  status
)
VALUES
  (
    '00000000-0000-4000-8000-00000000b301',
    '00000000-0000-4000-8000-00000000b201',
    '00000000-0000-4000-8000-00000000b102',
    'branch-staff@example.com',
    'Settings Staff',
    'sales_rep',
    '{"settings": {"edit": true}}'::jsonb,
    'active'
  ),
  (
    '00000000-0000-4000-8000-00000000b302',
    '00000000-0000-4000-8000-00000000b202',
    '00000000-0000-4000-8000-00000000b103',
    'branch-other-staff@example.com',
    'Other Merchant Staff',
    'admin',
    '{}'::jsonb,
    'active'
  );

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b102', true);

INSERT INTO public.branches (
  id,
  merchant_id,
  name,
  city,
  is_default,
  active,
  manager_id
)
VALUES (
  '00000000-0000-4000-8000-00000000b401',
  '00000000-0000-4000-8000-00000000b201',
  'Lagos main',
  'Lagos',
  true,
  true,
  '00000000-0000-4000-8000-00000000b301'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.branches (
      id,
      merchant_id,
      name,
      active,
      manager_id
    )
    VALUES (
      '00000000-0000-4000-8000-00000000b499',
      '00000000-0000-4000-8000-00000000b201',
      'Bad manager branch',
      true,
      '00000000-0000-4000-8000-00000000b302'
    );

    RAISE EXCEPTION 'cross-merchant manager assignment unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;
END;
$$ LANGUAGE plpgsql;

INSERT INTO public.branches (
  id,
  merchant_id,
  name,
  city,
  is_default,
  active
)
VALUES
  (
    '00000000-0000-4000-8000-00000000b402',
    '00000000-0000-4000-8000-00000000b201',
    'Abuja branch',
    'Abuja',
    false,
    true
  ),
  (
    '00000000-0000-4000-8000-00000000b403',
    '00000000-0000-4000-8000-00000000b201',
    'Inactive branch',
    'Lagos',
    false,
    false
  );

UPDATE public.branches
SET is_default = true
WHERE id = '00000000-0000-4000-8000-00000000b402';

DO $$
DECLARE
  branch_one_default boolean;
  branch_two_default boolean;
BEGIN
  SELECT is_default INTO branch_one_default
  FROM public.branches
  WHERE id = '00000000-0000-4000-8000-00000000b401';

  SELECT is_default INTO branch_two_default
  FROM public.branches
  WHERE id = '00000000-0000-4000-8000-00000000b402';

  IF branch_one_default IS TRUE OR branch_two_default IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ensure_single_default_branch trigger did not switch active default';
  END IF;
END;
$$ LANGUAGE plpgsql;

UPDATE public.branches
SET is_default = true
WHERE id = '00000000-0000-4000-8000-00000000b401';

DO $$
BEGIN
  BEGIN
    UPDATE public.branches
    SET merchant_id = '00000000-0000-4000-8000-00000000b202'
    WHERE id = '00000000-0000-4000-8000-00000000b402';

    RAISE EXCEPTION 'branch merchant_id update unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  BEGIN
    UPDATE public.branches
    SET is_default = true
    WHERE id = '00000000-0000-4000-8000-00000000b403';

    RAISE EXCEPTION 'inactive branch default update unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  BEGIN
    UPDATE public.branches
    SET is_default = false
    WHERE id = '00000000-0000-4000-8000-00000000b401';

    RAISE EXCEPTION 'clearing the only active default unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  BEGIN
    UPDATE public.branches
    SET active = false
    WHERE id = '00000000-0000-4000-8000-00000000b402';

    RAISE EXCEPTION 'direct active=false branch update unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  rows_deleted integer;
BEGIN
  DELETE FROM public.branches
  WHERE id = '00000000-0000-4000-8000-00000000b402';

  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  IF rows_deleted <> 0 THEN
    RAISE EXCEPTION 'authenticated hard delete affected % branch rows', rows_deleted;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.branches
    WHERE id = '00000000-0000-4000-8000-00000000b402'
  ) THEN
    RAISE EXCEPTION 'authenticated hard delete removed a branch';
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  inactive_error_message text;
  cross_merchant_error_message text;
BEGIN
  BEGIN
    INSERT INTO public.orders (
      id,
      merchant_id,
      order_number,
      customer_name,
      total,
      branch_id
    )
    VALUES (
      '00000000-0000-4000-8000-00000000b501',
      '00000000-0000-4000-8000-00000000b201',
      'BTEST-001',
      'Branch Test',
      100,
      '00000000-0000-4000-8000-00000000b403'
    );

    RAISE EXCEPTION 'inactive order branch assignment unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN
      inactive_error_message := SQLERRM;
      NULL;
  END;

  BEGIN
    INSERT INTO public.orders (
      id,
      merchant_id,
      order_number,
      customer_name,
      total,
      branch_id
    )
    VALUES (
      '00000000-0000-4000-8000-00000000b503',
      '00000000-0000-4000-8000-00000000b202',
      'BTEST-003',
      'Branch Test',
      100,
      '00000000-0000-4000-8000-00000000b401'
    );

    RAISE EXCEPTION 'cross-merchant order branch assignment unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN
      cross_merchant_error_message := SQLERRM;
      NULL;
  END;

  IF inactive_error_message IS DISTINCT FROM 'Invalid branch assignment'
    OR cross_merchant_error_message IS DISTINCT FROM 'Invalid branch assignment'
  THEN
    RAISE EXCEPTION 'branch assignment errors must not reveal branch state or ownership: inactive=%, cross_merchant=%',
      inactive_error_message,
      cross_merchant_error_message;
  END IF;

  INSERT INTO public.branches (
    id,
    merchant_id,
    name,
    city,
    is_default,
    active
  )
  VALUES (
    '00000000-0000-4000-8000-00000000b404',
    '00000000-0000-4000-8000-00000000b201',
    'Historical branch',
    'Lagos',
    false,
    true
  );

  INSERT INTO public.orders (
    id,
    merchant_id,
    order_number,
    customer_name,
    total,
    branch_id
  )
  VALUES (
    '00000000-0000-4000-8000-00000000b502',
    '00000000-0000-4000-8000-00000000b201',
    'BTEST-002',
    'Branch Test',
    100,
    '00000000-0000-4000-8000-00000000b404'
  );

  PERFORM public.deactivate_branch('00000000-0000-4000-8000-00000000b404');

	  UPDATE public.orders
	  SET customer_name = 'Historical update still allowed'
	  WHERE id = '00000000-0000-4000-8000-00000000b502';
END;
$$ LANGUAGE plpgsql;

INSERT INTO public.virtual_terminals (
  id,
  merchant_id,
  code,
  name,
  branch_id
)
VALUES (
  '00000000-0000-4000-8000-00000000b601',
  '00000000-0000-4000-8000-00000000b201',
  'BRANCHTEST',
  'Branch Test Terminal',
  '00000000-0000-4000-8000-00000000b401'
);

DO $$
BEGIN
  PERFORM public.deactivate_branch('00000000-0000-4000-8000-00000000b401');
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  active_default_count integer;
  branch_audit_count integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.virtual_terminals
    WHERE id = '00000000-0000-4000-8000-00000000b601'
      AND branch_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'deactivation did not atomically unassign branch terminals';
  END IF;

  SELECT count(*) INTO active_default_count
  FROM public.branches
  WHERE merchant_id = '00000000-0000-4000-8000-00000000b201'
    AND active = true
    AND is_default = true;

  IF active_default_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one active default after default deactivation, found %', active_default_count;
  END IF;

  SELECT count(*) INTO branch_audit_count
  FROM public.audit_logs
  WHERE merchant_id = '00000000-0000-4000-8000-00000000b201'
    AND resource_type = 'branch'
    AND action IN ('branch.create', 'branch.update', 'branch.deactivate');

  IF branch_audit_count < 4 THEN
    RAISE EXCEPTION 'expected branch mutation audit rows, found %', branch_audit_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  BEGIN
    PERFORM public.deactivate_branch('00000000-0000-4000-8000-00000000b402');

    RAISE EXCEPTION 'only-active branch deactivation unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;
END;
$$ LANGUAGE plpgsql;

RESET ROLE;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.branches (
      id,
      merchant_id,
      name,
      active
    )
    VALUES (
      '00000000-0000-4000-8000-00000000b498',
      '00000000-0000-4000-8000-00000000b201',
      'No actor branch',
      true
    );

    RAISE EXCEPTION 'service-role/no-actor branch insert unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$ LANGUAGE plpgsql;

SELECT set_config('app.branch_audit_actor_id', '00000000-0000-4000-8000-00000000b101', true);

INSERT INTO public.branches (
  id,
  merchant_id,
  name,
  active
)
VALUES (
  '00000000-0000-4000-8000-00000000b499',
  '00000000-0000-4000-8000-00000000b201',
  'System actor branch',
  true
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.audit_logs
    WHERE user_id = '00000000-0000-4000-8000-00000000b101'
      AND resource_id = '00000000-0000-4000-8000-00000000b499'
      AND action = 'branch.create'
  ) THEN
    RAISE EXCEPTION 'branch audit actor setting did not create audit row';
  END IF;
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
