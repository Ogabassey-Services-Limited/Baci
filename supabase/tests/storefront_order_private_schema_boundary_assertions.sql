\set ON_ERROR_STOP on

DO $$
DECLARE
  v_result uuid;
BEGIN
  IF pg_catalog.has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'authenticated still has direct private schema access';
  END IF;

  IF NOT pg_catalog.has_schema_privilege('anon', 'private', 'USAGE')
    OR NOT pg_catalog.has_schema_privilege('service_role', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'storefront execution roles lost private schema access';
  END IF;

  IF pg_catalog.has_table_privilege(
      'anon',
      'private.merchant_payment_credentials',
      'SELECT'
    )
    OR pg_catalog.has_table_privilege(
      'authenticated',
      'private.merchant_payment_credentials',
      'SELECT'
    )
    OR pg_catalog.has_table_privilege(
      'service_role',
      'private.merchant_payment_credentials',
      'SELECT'
    ) THEN
    RAISE EXCEPTION 'Data API role retained direct credential vault access';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc
    WHERE oid = 'public.create_storefront_order(uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, text, text)'::regprocedure
      AND prosecdef
      AND proowner = 'postgres'::regrole
  ) THEN
    RAISE EXCEPTION 'storefront order wrapper is not SECURITY DEFINER owned by postgres';
  END IF;

  SET LOCAL ROLE authenticated;
  SELECT id
    INTO v_result
  FROM public.create_storefront_order(
    '00000000-0000-0000-0000-000000000002'::uuid,
    'buyer@example.com',
    'Buyer',
    '[]'::jsonb
  );
  RESET ROLE;

  IF v_result IS DISTINCT FROM '00000000-0000-0000-0000-000000000001'::uuid THEN
    RAISE EXCEPTION 'authenticated storefront checkout RPC returned the wrong result';
  END IF;
END;
$$;

DO $$
DECLARE
  v_result uuid;
BEGIN
  SET LOCAL ROLE anon;
  SELECT id
    INTO v_result
  FROM public.create_storefront_order(
    '00000000-0000-0000-0000-000000000002'::uuid,
    'buyer@example.com',
    'Buyer',
    '[]'::jsonb
  );
  RESET ROLE;

  IF v_result IS DISTINCT FROM '00000000-0000-0000-0000-000000000001'::uuid THEN
    RAISE EXCEPTION 'anonymous storefront checkout RPC returned the wrong result';
  END IF;
END;
$$;
