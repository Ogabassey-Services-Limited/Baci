-- Regression contract for public.get_mobile_admin_order_counts(uuid, uuid).
-- Run after applying its migration to a local PostgreSQL database.

BEGIN;

DO $contract$
DECLARE
  v_proc oid;
  v_arg_names text[];
  v_arg_types text;
  v_args text;
  v_result_type text;
  v_source text;
BEGIN
  SELECT
    proc.oid,
    proc.proargnames,
    pg_catalog.oidvectortypes(proc.proargtypes),
    pg_catalog.pg_get_function_arguments(proc.oid),
    pg_catalog.pg_get_function_result(proc.oid),
    proc.prosrc
  INTO v_proc, v_arg_names, v_arg_types, v_args, v_result_type, v_source
  FROM pg_catalog.pg_proc AS proc
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = proc.pronamespace
  WHERE namespace.nspname = 'public'
    AND proc.proname = 'get_mobile_admin_order_counts'
    AND pg_catalog.oidvectortypes(proc.proargtypes) = 'uuid, uuid';

  IF v_proc IS NULL THEN
    RAISE EXCEPTION 'mobile-admin order-count RPC is missing';
  END IF;

  IF v_arg_names IS DISTINCT FROM ARRAY['p_merchant_id', 'p_branch_id'] THEN
    RAISE EXCEPTION 'order-count RPC argument names drifted: %', v_arg_names;
  END IF;

  IF v_arg_types IS DISTINCT FROM 'uuid, uuid' THEN
    RAISE EXCEPTION 'order-count RPC argument types drifted: %', v_arg_types;
  END IF;

  IF v_args !~* 'p_branch_id uuid DEFAULT NULL(::uuid)?' THEN
    RAISE EXCEPTION 'order-count RPC branch default drifted: %', v_args;
  END IF;

  IF v_result_type IS DISTINCT FROM 'jsonb' THEN
    RAISE EXCEPTION 'order-count RPC result type drifted: %', v_result_type;
  END IF;

  IF v_source !~* 'IF\s+p_branch_id\s+IS\s+NULL\s+THEN'
    OR v_source !~* 'orders\.branch_id\s*=\s*p_branch_id'
    OR v_source ~* 'p_branch_id\s+IS\s+NULL\s+OR\s+orders\.branch_id'
  THEN
    RAISE EXCEPTION
      'order-count RPC must keep all-branch and branch-scoped plans separate';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS proc
    WHERE proc.oid = v_proc
      AND proc.prosecdef
      AND proc.provolatile = 's'
      AND proc.proowner = 'postgres'::pg_catalog.regrole
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.pg_options_to_table(
          COALESCE(proc.proconfig, ARRAY[]::text[])
        ) AS config
        WHERE config.option_name = 'search_path'
          AND pg_catalog.btrim(config.option_value, '"') = ''
      )
  ) THEN
    RAISE EXCEPTION
      'order-count RPC must be STABLE SECURITY DEFINER owned by postgres with blank search_path';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS proc
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(proc.proacl, pg_catalog.acldefault('f', proc.proowner))
    ) AS acl
    WHERE proc.oid = v_proc
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC unexpectedly executes order-count RPC';
  END IF;

  IF pg_catalog.has_function_privilege('anon', v_proc, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon unexpectedly executes order-count RPC';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
    'authenticated', v_proc, 'EXECUTE'
  ) OR NOT pg_catalog.has_function_privilege(
    'service_role', v_proc, 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'order-count RPC API-role grants are incomplete';
  END IF;
END;
$contract$;

ROLLBACK;
