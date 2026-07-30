BEGIN;

DO $$
DECLARE
  v_is_not_null boolean;
  v_null_count integer;
BEGIN
  SELECT attribute.attnotnull
    INTO v_is_not_null
    FROM pg_catalog.pg_attribute AS attribute
   WHERE attribute.attrelid = 'public.merchants'::pg_catalog.regclass
     AND attribute.attname = 'updated_at'
     AND attribute.attnum > 0
     AND NOT attribute.attisdropped;

  SELECT count(*)
    INTO v_null_count
    FROM public.merchants
   WHERE updated_at IS NULL;

  IF v_is_not_null IS DISTINCT FROM true OR v_null_count <> 0 THEN
    RAISE EXCEPTION
      'merchant updated_at OCC token is nullable: not_null=%, null_count=%',
      v_is_not_null,
      v_null_count;
  END IF;
END;
$$;

DO $$
DECLARE
  v_legacy_trigger_count integer;
  v_strict_trigger_count integer;
BEGIN
  SELECT count(*)
    INTO v_legacy_trigger_count
    FROM pg_catalog.pg_trigger AS trigger
   WHERE trigger.tgrelid = 'public.merchants'::pg_catalog.regclass
     AND NOT trigger.tgisinternal
     AND trigger.tgname = 'update_merchants_updated_at';

  SELECT count(*)
    INTO v_strict_trigger_count
    FROM pg_catalog.pg_trigger AS trigger
   WHERE trigger.tgrelid = 'public.merchants'::pg_catalog.regclass
     AND NOT trigger.tgisinternal
     AND trigger.tgname = 'merchants_set_updated_at'
     AND trigger.tgfoid = 'private.set_merchants_updated_at()'::pg_catalog.regprocedure;

  IF v_legacy_trigger_count <> 0 OR v_strict_trigger_count <> 1 THEN
    RAISE EXCEPTION
      'merchant updated_at trigger ownership invalid: legacy=%, strict=%',
      v_legacy_trigger_count,
      v_strict_trigger_count;
  END IF;
END;
$$;

DO $$
DECLARE
  v_merchant_id uuid := 'a3200000-0000-4000-8000-000000000002';
  v_updated_at timestamptz;
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    'a3200000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'merchant-updated-at-occ@example.com',
    'test',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );

  INSERT INTO public.merchants (id, user_id, email, business_name)
  VALUES (
    v_merchant_id,
    'a3200000-0000-4000-8000-000000000001',
    'merchant-updated-at-occ@example.com',
    'Initial Store'
  );

  SELECT updated_at
    INTO v_updated_at
    FROM public.merchants
   WHERE id = v_merchant_id;

  IF v_updated_at IS NULL THEN
    RAISE EXCEPTION 'new merchant did not receive an OCC token';
  END IF;
END;
$$;

SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', 'a3200000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_result jsonb;
  v_before_direct_write timestamptz;
  v_updated_at timestamptz;
BEGIN
  SELECT updated_at
    INTO v_before_direct_write
    FROM public.merchants
   WHERE id = 'a3200000-0000-4000-8000-000000000002';

  UPDATE public.merchants
     SET business_name = 'Directly Updated Store'
   WHERE id = 'a3200000-0000-4000-8000-000000000002'
   RETURNING updated_at
    INTO v_updated_at;

  IF v_updated_at IS NULL OR v_updated_at <= v_before_direct_write THEN
    RAISE EXCEPTION
      'direct merchant update did not advance the OCC token: before=%, after=%',
      v_before_direct_write,
      v_updated_at;
  END IF;

  BEGIN
    PERFORM public.update_merchant_identity_settings(
      'a3200000-0000-4000-8000-000000000002',
      '{"business_name":"Stale Store"}'::jsonb,
      v_before_direct_write
    );
    RAISE EXCEPTION 'stale OCC token unexpectedly succeeded';
  EXCEPTION
    WHEN SQLSTATE '40001' THEN NULL;
  END;

  v_result := public.update_merchant_identity_settings(
    'a3200000-0000-4000-8000-000000000002',
    '{"business_name":"Updated Store"}'::jsonb,
    v_updated_at
  );

  IF v_result ->> 'business_name' IS DISTINCT FROM 'Updated Store'
    OR v_result ->> 'updated_at' IS NULL
    OR (v_result ->> 'updated_at')::timestamptz <= v_updated_at THEN
    RAISE EXCEPTION 'guarded OCC update did not return a fresh token: %', v_result;
  END IF;
END;
$$;

RESET ROLE;
ROLLBACK;
