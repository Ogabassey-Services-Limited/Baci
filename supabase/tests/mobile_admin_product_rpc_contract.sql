-- =============================================
-- REGRESSION TEST: mobile admin product RPC contract
--   Validates the live database signature and API-role permissions for the
--   RPC that the mobile admin product-save path calls by named arguments.
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/mobile_admin_product_rpc_contract.sql
-- =============================================

BEGIN;

DO $$
DECLARE
  v_proc oid;
  v_arg_names text[];
  v_arg_types text;
  v_args text;
  v_result_type text;
  v_is_security_definer boolean;
BEGIN
  SELECT
    p.oid,
    p.proargnames,
    pg_catalog.oidvectortypes(p.proargtypes),
    pg_get_function_arguments(p.oid),
    pg_get_function_result(p.oid),
    p.prosecdef
  INTO
    v_proc,
    v_arg_names,
    v_arg_types,
    v_args,
    v_result_type,
    v_is_security_definer
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'save_mobile_admin_product_with_variants'
  ORDER BY (
    pg_catalog.oidvectortypes(p.proargtypes) = 'uuid, uuid, jsonb, jsonb, text'
  ) DESC
  LIMIT 1;

  IF v_proc IS NULL THEN
    RAISE EXCEPTION 'mobile admin product RPC function is missing';
  END IF;

  IF v_arg_names IS DISTINCT FROM ARRAY[
    'p_merchant_id',
    'p_product_id',
    'p_product_payload',
    'p_variants',
    'p_variant_model'
  ] THEN
    RAISE EXCEPTION 'mobile admin product RPC argument names drifted: %', v_arg_names;
  END IF;

  IF v_arg_types IS DISTINCT FROM 'uuid, uuid, jsonb, jsonb, text' THEN
    RAISE EXCEPTION 'mobile admin product RPC argument types drifted: %', v_arg_types;
  END IF;

  IF v_args !~* 'p_variants jsonb DEFAULT ''\[\]''::jsonb'
    OR v_args !~* 'p_variant_model text DEFAULT NULL(::text)?'
  THEN
    RAISE EXCEPTION 'mobile admin product RPC defaults drifted: %', v_args;
  END IF;

  IF v_result_type IS DISTINCT FROM 'jsonb' THEN
    RAISE EXCEPTION 'mobile admin product RPC result type drifted: %', v_result_type;
  END IF;

  IF v_is_security_definer IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'mobile admin product RPC must remain SECURITY DEFINER';
  END IF;

  IF has_function_privilege('anon', v_proc, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon unexpectedly has EXECUTE on mobile admin product RPC';
  END IF;

  IF NOT has_function_privilege('authenticated', v_proc, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lacks EXECUTE on mobile admin product RPC';
  END IF;

  IF NOT has_function_privilege('service_role', v_proc, 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role lacks EXECUTE on mobile admin product RPC';
  END IF;
END $$;

ROLLBACK;
