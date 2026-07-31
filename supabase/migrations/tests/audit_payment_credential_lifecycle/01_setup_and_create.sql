CREATE FUNCTION pg_temp.assert_task6_redacted_audit_rows(
  p_audit_text text,
  p_sentinels text[],
  p_lifecycle text
)
RETURNS void
LANGUAGE plpgsql
AS $assert$
DECLARE
  v_sentinel text;
  v_suffix text;
  v_masked_suffix text;
  v_fixed_width_masked_suffix text;
  v_md5 text;
  v_sha256 text;
BEGIN
  IF NULLIF(p_audit_text, '') IS NULL THEN
    RAISE EXCEPTION '% redaction assertion did not receive serialized audit rows',
      p_lifecycle;
  END IF;
  IF COALESCE(pg_catalog.cardinality(p_sentinels), 0) = 0 THEN
    RAISE EXCEPTION '% redaction assertion did not receive sentinel corpus',
      p_lifecycle;
  END IF;

  FOREACH v_sentinel IN ARRAY p_sentinels LOOP
    v_suffix := pg_catalog.right(v_sentinel, 4);
    v_masked_suffix := '****' || v_suffix;
    v_fixed_width_masked_suffix := pg_catalog.repeat(
      '*',
      GREATEST(pg_catalog.char_length(v_sentinel) - pg_catalog.char_length(v_suffix), 1)
    ) || v_suffix;
    v_md5 := pg_catalog.md5(v_sentinel);
    v_sha256 := pg_catalog.encode(extensions.digest(v_sentinel, 'sha256'), 'hex');

    IF pg_catalog.strpos(p_audit_text, v_sentinel) > 0
       OR pg_catalog.strpos(p_audit_text, v_suffix) > 0
       OR pg_catalog.strpos(p_audit_text, v_masked_suffix) > 0
       OR pg_catalog.strpos(p_audit_text, v_fixed_width_masked_suffix) > 0
       OR pg_catalog.strpos(p_audit_text, v_md5) > 0
       OR pg_catalog.strpos(p_audit_text, v_sha256) > 0 THEN
      RAISE EXCEPTION '% audit row leaked raw, suffix, masked, or unsalted-hash sensitive evidence',
        p_lifecycle;
    END IF;
  END LOOP;
END;
$assert$;

INSERT INTO audit_payment_credential_sentinels (lifecycle, value) VALUES
  ('create', 'task6-ciphertext-sentinel-QWZX'),
  ('create', 'task6-key-last4-sentinel-RSTV'),
  ('disable', 'task6-validation-error-sentinel-XQWZ'),
  ('disable', 'task6-disabled-reason-sentinel-VWXY'),
  ('pair', 'task6-client-ciphertext-sentinel-ZQRT'),
  ('pair', 'task6-client-last4-sentinel-WXQR'),
  ('pair', 'task6-secret-ciphertext-sentinel-RTVW'),
  ('pair', 'task6-secret-last4-sentinel-QVWX'),
  ('pair_update', 'task6-client-rotate-ciphertext-sentinel-QXRV'),
  ('pair_update', 'task6-client-rotate-last4-sentinel-WZQT'),
  ('pair_update', 'task6-secret-rotate-ciphertext-sentinel-RVWX'),
  ('pair_update', 'task6-secret-rotate-last4-sentinel-ZQWR'),
  ('delete', 'task6-delete-ciphertext-sentinel-XWZR'),
  ('delete', 'task6-delete-last4-sentinel-ZTVW'),
  ('cascade', 'task6-cascade-ciphertext-sentinel-RQWX'),
  ('cascade', 'task6-cascade-last4-sentinel-WXQZ');

DO $test$
DECLARE
  v_actor_id uuid := '7e3f2e60-0000-4000-8000-000000000001';
  v_merchant_id uuid := '7e3f2e60-0000-4000-8000-000000000002';
  v_live_columns text[];
  v_exact_columns text[] := ARRAY[
    'credential_role', 'environment', 'is_active', 'kek_version', 'provider'
  ];
  v_presence_columns text[] := ARRAY[
    'ciphertext', 'disabled_at', 'last_validated_at'
  ];
  v_ignored_columns text[] := ARRAY['created_at', 'updated_at'];
  v_forbidden_columns text[] := ARRAY[
    'disabled_reason', 'id', 'key_last4', 'last_validation_error', 'merchant_id'
  ];
  v_classified_columns text[];
  v_credential_id uuid;
  v_event record;
  v_event_found boolean;
  v_create_count integer;
  v_vault_rpc regprocedure;
  v_vault_rpcs regprocedure[] := ARRAY[
    'public.set_merchant_payment_credential(uuid,text,text,text,text,smallint,text)'::regprocedure,
    'public.get_merchant_payment_credential_meta(uuid,text)'::regprocedure,
    'public.get_merchant_payment_credential_ciphertext(uuid,text,text,text)'::regprocedure,
    'public.mark_merchant_payment_credential_invalid(uuid,text,text,text,text)'::regprocedure,
    'public.delete_merchant_payment_credential(uuid,text)'::regprocedure,
    'public.delete_merchant_payment_credential_role(uuid,text,text,text)'::regprocedure,
    'public.replace_merchant_payment_credential_pair(uuid,text,text,text,smallint,text,text,smallint,text)'::regprocedure
  ];
BEGIN
  v_classified_columns := v_exact_columns || v_presence_columns ||
    v_ignored_columns || v_forbidden_columns;

  SELECT array_agg(column_name ORDER BY column_name)
    INTO v_live_columns
  FROM information_schema.columns
  WHERE table_schema = 'private' AND table_name = 'merchant_payment_credentials';

  IF (SELECT count(*) FROM pg_catalog.unnest(v_classified_columns)) <>
       (SELECT count(DISTINCT column_name)
        FROM pg_catalog.unnest(v_classified_columns) AS column_name)
     OR v_live_columns IS DISTINCT FROM (
       SELECT array_agg(column_name ORDER BY column_name)
       FROM pg_catalog.unnest(v_classified_columns) AS column_name
     ) THEN
    RAISE EXCEPTION 'private.merchant_payment_credentials Task 6 audit classification is incomplete or overlapping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc
    WHERE oid = 'private.audit_payment_credential_change_v1()'::pg_catalog.regprocedure
      AND prosecdef
  ) THEN
    RAISE EXCEPTION 'payment credential trigger wrapper must be SECURITY DEFINER';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(ARRAY['anon', 'authenticated', 'service_role']) AS role_name
    WHERE pg_catalog.has_function_privilege(
      role_name,
      'private.audit_payment_credential_change_v1()'::pg_catalog.regprocedure,
      'EXECUTE'
    )
  ) THEN
    RAISE EXCEPTION 'payment credential trigger wrapper is directly executable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgname = 'audit_payment_credential_change_v1'
      AND tgrelid = 'private.merchant_payment_credentials'::pg_catalog.regclass
      AND tgfoid = 'private.audit_payment_credential_change_v1()'::pg_catalog.regprocedure
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'payment credential audit trigger missing';
  END IF;
  FOREACH v_vault_rpc IN ARRAY v_vault_rpcs LOOP
    IF NOT pg_catalog.has_function_privilege('service_role', v_vault_rpc::oid, 'EXECUTE')
       OR pg_catalog.has_function_privilege('anon', v_vault_rpc::oid, 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated', v_vault_rpc::oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'payment credential vault RPC grant drifted: %', v_vault_rpc;
    END IF;
  END LOOP;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    v_actor_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'task6-owner@example.com', 'test', pg_catalog.now(),
    pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb
  );

  PERFORM pg_catalog.set_config('app.audit_actor_user_id', v_actor_id::text, true);
  INSERT INTO public.merchants (
    id, user_id, email, phone, business_name, slug, country, support_email,
    support_phone
  ) VALUES (
    v_merchant_id, v_actor_id, 'task6-merchant@example.com', '+2348010101060',
    'Task 6 Credential Store', 'task6-credential-store', 'Nigeria',
    'support-task6@example.com', '+2348010101061'
  );

  SET LOCAL ROLE service_role;
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    '{"role":"service_role"}',
    true
  );
  SELECT public.set_merchant_payment_credential(
    v_merchant_id, 'paypal', 'webhook_secret', 'live',
    'task6-ciphertext-sentinel-QWZX', 3::smallint,
    'task6-key-last4-sentinel-RSTV'
  ) INTO v_credential_id;
  RESET ROLE;

  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND metadata ->> 'category' = 'payment_credential'
    AND action = 'payment_credential.create'
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;
  v_event_found := FOUND;
  SELECT count(*) INTO v_create_count
  FROM public.audit_events
  WHERE merchant_id = v_merchant_id
    AND metadata ->> 'category' = 'payment_credential'
    AND action = 'payment_credential.create'
    AND resource_id = v_credential_id::text;
  IF v_create_count IS DISTINCT FROM 1
     OR NOT v_event_found
     OR v_event.resource_type IS DISTINCT FROM 'merchant_payment_credential'
     OR v_event.resource_id IS DISTINCT FROM v_credential_id::text
     OR v_event.actor_type IS DISTINCT FROM 'service'
     OR v_event.after_values -> 'slot' IS DISTINCT FROM
       '{"provider":"paypal","credential_role":"webhook_secret","environment":"live","kek_version":3}'::jsonb
     OR v_event.after_values -> 'credential_state' IS DISTINCT FROM
       '{"present":true,"state":"configured"}'::jsonb
     OR v_event.after_values -> 'active_state' IS DISTINCT FROM
       '{"state":"active","disabled_at_present":false,"disabled_reason_present":false}'::jsonb
     OR v_event.after_values -> 'validation_state' IS DISTINCT FROM
       '{"state":"unvalidated","last_validated_at_present":false,"error_present":false}'::jsonb THEN
    RAISE EXCEPTION 'credential creation did not retain the bounded slot lifecycle evidence';
  END IF;
END;
$test$;
