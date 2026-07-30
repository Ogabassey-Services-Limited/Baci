-- Regression contract for 20260730000500_audit_payment_credential_lifecycle.sql.
-- This fixture runs after every pending migration and rolls back all rows.

BEGIN;

CREATE TEMP TABLE audit_payment_credential_sentinels (
  lifecycle text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (lifecycle, value)
);

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

-- Unknown columns must fail closed on the next governed mutation.
ALTER TABLE private.merchant_payment_credentials
  ADD COLUMN audit_payment_credential_unclassified_probe text;
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $test$
BEGIN
  BEGIN
    PERFORM public.set_merchant_payment_credential(
      '7e3f2e60-0000-4000-8000-000000000002', 'paypal', 'webhook_secret',
      'live', 'task6-ciphertext-sentinel-QWZX', 3::smallint,
      'task6-key-last4-sentinel-RSTV'
    );
    RAISE EXCEPTION 'unclassified credential column unexpectedly bypassed audit guard';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM IS DISTINCT FROM 'audit_payment_credential_unclassified_column' THEN
      RAISE;
    END IF;
  END;
END;
$test$;
RESET ROLE;
ALTER TABLE private.merchant_payment_credentials
  DROP COLUMN audit_payment_credential_unclassified_probe;

-- A single credential slot records one event per real lifecycle operation and
-- never writes ciphertext, last-four, validation errors, or disabled reasons.
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT public.mark_merchant_payment_credential_invalid(
  '7e3f2e60-0000-4000-8000-000000000002', 'paypal', 'webhook_secret', 'live',
  'task6-validation-error-sentinel-XQWZ; task6-disabled-reason-sentinel-VWXY'
);
RESET ROLE;

DO $test$
DECLARE v_event record; v_audit_text text; v_disable_count integer;
BEGIN
  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'payment_credential'
    AND action = 'payment_credential.update'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'payment_credential';
  SELECT count(*) INTO v_disable_count
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'payment_credential'
    AND action = 'payment_credential.update';

  IF v_disable_count IS DISTINCT FROM 1
     OR v_event.changed_fields IS DISTINCT FROM ARRAY['active_state', 'validation_state']::text[]
     OR v_event.after_values -> 'active_state' IS DISTINCT FROM
       '{"state":"inactive","disabled_at_present":true,"disabled_reason_present":true,"disabled_reason_change":{"present":true,"state":"configured"}}'::jsonb
     OR v_event.after_values -> 'validation_state' IS DISTINCT FROM
       '{"state":"failed","last_validated_at_present":false,"error_present":true,"error_change":{"present":true,"state":"configured"}}'::jsonb THEN
    RAISE EXCEPTION 'credential disable did not retain one bounded lifecycle event';
  END IF;
  PERFORM pg_temp.assert_task6_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value FROM audit_payment_credential_sentinels
      WHERE lifecycle IN ('create', 'disable') ORDER BY value
    ),
    'credential create and disable'
  );
END;
$test$;

-- Replacing an invalid credential through the service-only vault RPC emits one
-- row event with its safe reactivation and validation-reset lifecycle states.
CREATE TEMP TABLE audit_payment_credential_reactivation_before AS
SELECT id
FROM public.audit_events
WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'payment_credential';
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT public.set_merchant_payment_credential(
  '7e3f2e60-0000-4000-8000-000000000002', 'paypal', 'webhook_secret',
  'live', 'task6-ciphertext-sentinel-QWZX', 3::smallint,
  'task6-key-last4-sentinel-RSTV'
);
RESET ROLE;

DO $test$
DECLARE v_event record; v_reactivation_count integer; v_audit_text text;
BEGIN
  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'payment_credential'
    AND action = 'payment_credential.update'
    AND id NOT IN (SELECT id FROM audit_payment_credential_reactivation_before)
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT count(*), string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n')
    INTO v_reactivation_count, v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'payment_credential'
    AND id NOT IN (SELECT id FROM audit_payment_credential_reactivation_before);
  IF v_reactivation_count IS DISTINCT FROM 1
     OR v_event.changed_fields IS DISTINCT FROM ARRAY['active_state', 'validation_state']::text[]
     OR v_event.after_values -> 'active_state' IS DISTINCT FROM
       '{"state":"active","disabled_at_present":false,"disabled_reason_present":false,"disabled_reason_change":{"present":false,"state":"cleared"}}'::jsonb
     OR v_event.after_values -> 'validation_state' IS DISTINCT FROM
       '{"state":"unvalidated","last_validated_at_present":false,"error_present":false,"error_change":{"present":false,"state":"cleared"}}'::jsonb THEN
    RAISE EXCEPTION 'credential reactivation did not emit exactly one safe slot event';
  END IF;
  PERFORM pg_temp.assert_task6_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value FROM audit_payment_credential_sentinels
      WHERE lifecycle IN ('create', 'disable') ORDER BY value
    ),
    'credential reactivation'
  );
END;
$test$;

-- A pair replacement has two row-level events, one for each role, and the
-- canonical writer assigns both the same database transaction identifier.
CREATE TEMP TABLE audit_payment_credential_pair_before AS
SELECT id
FROM public.audit_events
WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'payment_credential';

SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT public.replace_merchant_payment_credential_pair(
  '7e3f2e60-0000-4000-8000-000000000002', 'paypal', 'test',
  'task6-client-ciphertext-sentinel-ZQRT', 5::smallint, 'task6-client-last4-sentinel-WXQR',
  'task6-secret-ciphertext-sentinel-RTVW', 5::smallint, 'task6-secret-last4-sentinel-QVWX'
);
RESET ROLE;

DO $test$
DECLARE v_event_count integer; v_transaction_count integer; v_roles text[]; v_audit_text text;
BEGIN
  SELECT count(*), count(DISTINCT database_transaction_id),
         array_agg(after_values -> 'slot' ->> 'credential_role' ORDER BY after_values -> 'slot' ->> 'credential_role')
    INTO v_event_count, v_transaction_count, v_roles
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'payment_credential'
    AND id NOT IN (SELECT id FROM audit_payment_credential_pair_before);
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'payment_credential'
    AND id NOT IN (SELECT id FROM audit_payment_credential_pair_before);

  IF v_event_count IS DISTINCT FROM 2
     OR v_transaction_count IS DISTINCT FROM 1
     OR v_roles IS DISTINCT FROM ARRAY['client_id', 'secret_key']::text[] THEN
    RAISE EXCEPTION 'pair replacement did not emit exactly two grouped slot events';
  END IF;
  PERFORM pg_temp.assert_task6_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value FROM audit_payment_credential_sentinels
      WHERE lifecycle = 'pair' ORDER BY value
    ),
    'credential pair replacement'
  );
END;
$test$;

-- Replace the same pair again to exercise the conflict-update path. Both
-- credential values rotate, but the audit payload remains lifecycle-only.
CREATE TEMP TABLE audit_payment_credential_pair_update_before AS
SELECT id
FROM public.audit_events
WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'payment_credential';
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT public.replace_merchant_payment_credential_pair(
  '7e3f2e60-0000-4000-8000-000000000002', 'paypal', 'test',
  'task6-client-rotate-ciphertext-sentinel-QXRV', 6::smallint, 'task6-client-rotate-last4-sentinel-WZQT',
  'task6-secret-rotate-ciphertext-sentinel-RVWX', 6::smallint, 'task6-secret-rotate-last4-sentinel-ZQWR'
);
RESET ROLE;

DO $test$
DECLARE
  v_event_count integer;
  v_transaction_count integer;
  v_roles text[];
  v_actions text[];
  v_kek_versions text[];
  v_all_rotated boolean;
  v_audit_text text;
BEGIN
  SELECT
    count(*),
    count(DISTINCT database_transaction_id),
    array_agg(after_values -> 'slot' ->> 'credential_role' ORDER BY after_values -> 'slot' ->> 'credential_role'),
    array_agg(action ORDER BY action),
    array_agg(after_values -> 'slot' ->> 'kek_version' ORDER BY after_values -> 'slot' ->> 'credential_role'),
    bool_and(
      after_values -> 'credential_state' = '{"present":true,"state":"rotated"}'::jsonb
      AND 'credential_state' = ANY(changed_fields)
    )
  INTO v_event_count, v_transaction_count, v_roles, v_actions, v_kek_versions, v_all_rotated
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'payment_credential'
    AND id NOT IN (SELECT id FROM audit_payment_credential_pair_update_before);
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'payment_credential'
    AND id NOT IN (SELECT id FROM audit_payment_credential_pair_update_before);

  IF v_event_count IS DISTINCT FROM 2
     OR v_transaction_count IS DISTINCT FROM 1
     OR v_roles IS DISTINCT FROM ARRAY['client_id', 'secret_key']::text[]
     OR v_actions IS DISTINCT FROM ARRAY['payment_credential.update', 'payment_credential.update']::text[]
     OR v_kek_versions IS DISTINCT FROM ARRAY['6', '6']::text[]
     OR v_all_rotated IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'pair conflict update did not retain two grouped credential rotations';
  END IF;
  PERFORM pg_temp.assert_task6_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value FROM audit_payment_credential_sentinels
      WHERE lifecycle = 'pair_update' ORDER BY value
    ),
    'credential pair conflict update'
  );
END;
$test$;

-- Delete one role through the live role-scoped RPC. The row event is singular
-- even though callers may later delete a complete provider set.
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT public.set_merchant_payment_credential(
  '7e3f2e60-0000-4000-8000-000000000002', 'stripe', 'public_key', 'live',
  'task6-delete-ciphertext-sentinel-XWZR', 4::smallint, 'task6-delete-last4-sentinel-ZTVW'
);
SELECT public.delete_merchant_payment_credential_role(
  '7e3f2e60-0000-4000-8000-000000000002', 'stripe', 'public_key', 'live'
);
RESET ROLE;

DO $test$
DECLARE v_delete_count integer; v_audit_text text;
BEGIN
  SELECT count(*) INTO v_delete_count
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
    AND action = 'payment_credential.delete'
    AND metadata ->> 'category' = 'payment_credential'
    AND before_values -> 'slot' ->> 'provider' = 'stripe';
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'payment_credential'
    AND before_values -> 'slot' ->> 'provider' = 'stripe';
  IF v_delete_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'role-scoped credential delete did not emit exactly one slot event';
  END IF;
  PERFORM pg_temp.assert_task6_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value FROM audit_payment_credential_sentinels
      WHERE lifecycle = 'delete' ORDER BY value
    ),
    'credential role delete'
  );
END;
$test$;

-- A parent cascade retains the immutable merchant UUID even though the lookup
-- label is unavailable after the parent row has been deleted.
DO $test$
DECLARE
  v_owner_id uuid := '7e3f2e60-0000-4000-8000-000000000003';
  v_merchant_id uuid := '7e3f2e60-0000-4000-8000-000000000004';
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    v_owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'task6-cascade-owner@example.com', 'test', pg_catalog.now(),
    pg_catalog.now(), pg_catalog.now(), '{}'::jsonb, '{}'::jsonb
  );
  PERFORM pg_catalog.set_config('app.audit_actor_user_id', v_owner_id::text, true);
  INSERT INTO public.merchants (
    id, user_id, email, phone, business_name, slug, country, support_email,
    support_phone
  ) VALUES (
    v_merchant_id, v_owner_id, 'task6-cascade@example.com', '+2348010101062',
    'Task 6 Cascade Store', 'task6-cascade-store', 'Nigeria',
    'support-task6-cascade@example.com', '+2348010101063'
  );
END;
$test$;

SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT public.set_merchant_payment_credential(
  '7e3f2e60-0000-4000-8000-000000000004', 'paypal', 'public_key', 'live',
  'task6-cascade-ciphertext-sentinel-RQWX', 2::smallint, 'task6-cascade-last4-sentinel-WXQZ'
);
DELETE FROM public.merchants
WHERE id = '7e3f2e60-0000-4000-8000-000000000004';
RESET ROLE;

DO $test$
DECLARE v_event record; v_audit_text text;
BEGIN
  SELECT * INTO v_event
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000004'
    AND action = 'payment_credential.cascade_delete'
    AND metadata ->> 'category' = 'payment_credential'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000004'
    AND metadata ->> 'category' = 'payment_credential';
  IF v_event.merchant_id IS DISTINCT FROM '7e3f2e60-0000-4000-8000-000000000004'::uuid
     OR v_event.merchant_label IS NOT NULL
     OR v_event.metadata ->> 'reason_code' IS DISTINCT FROM 'merchant_cascade'
     OR v_event.before_values -> 'credential_state' IS DISTINCT FROM
       '{"present":true}'::jsonb THEN
    RAISE EXCEPTION 'credential cascade did not retain deletion-safe merchant evidence';
  END IF;
  PERFORM pg_temp.assert_task6_redacted_audit_rows(
    v_audit_text,
    ARRAY(
      SELECT value FROM audit_payment_credential_sentinels
      WHERE lifecycle = 'cascade' ORDER BY value
    ),
    'credential merchant cascade'
  );
END;
$test$;

-- An RPC write that changes only ignored updated_at does not create a fake
-- lifecycle event.
CREATE TEMP TABLE audit_payment_credential_noop_before AS
SELECT count(*) AS event_count
FROM public.audit_events
WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'payment_credential';
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT public.set_merchant_payment_credential(
  '7e3f2e60-0000-4000-8000-000000000002', 'paypal', 'webhook_secret',
  'live', 'task6-ciphertext-sentinel-QWZX', 3::smallint,
  'task6-key-last4-sentinel-RSTV'
);
RESET ROLE;
DO $test$
DECLARE v_before_count integer; v_after_count integer;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_payment_credential_noop_before;
  SELECT count(*) INTO v_after_count
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'payment_credential';
  IF v_after_count IS DISTINCT FROM v_before_count THEN
    RAISE EXCEPTION 'credential updated_at-only RPC write emitted an event';
  END IF;
END;
$test$;

-- A trigger failure must roll back the service-only credential RPC as one unit.
SAVEPOINT audit_payment_credential_writer_failure;
DELETE FROM private.audit_event_writer_capabilities
WHERE capability_name = 'canonical_audit_event_writer_v1';
SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $test$
BEGIN
  BEGIN
    PERFORM public.set_merchant_payment_credential(
      '7e3f2e60-0000-4000-8000-000000000002', 'razorpay', 'public_key', 'live',
      'task6-rollback-ciphertext-sentinel-QXWR', 1::smallint, 'task6-rollback-last4-sentinel-RXWQ'
    );
    RAISE EXCEPTION 'credential RPC unexpectedly survived unavailable audit writer';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM IS DISTINCT FROM 'audit_payment_credential_writer_capability_unavailable' THEN
      RAISE;
    END IF;
  END;
END;
$test$;
RESET ROLE;
DO $test$
BEGIN
  IF EXISTS (
    SELECT 1 FROM private.merchant_payment_credentials
    WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
      AND provider = 'razorpay'
      AND credential_role = 'public_key'
      AND environment = 'live'
  ) OR EXISTS (
    SELECT 1 FROM public.audit_events
    WHERE merchant_id = '7e3f2e60-0000-4000-8000-000000000002'
      AND metadata ->> 'category' = 'payment_credential'
      AND after_values::text LIKE '%task6-rollback%'
  ) THEN
    RAISE EXCEPTION 'failed credential RPC left a row or audit event behind';
  END IF;
END;
$test$;
ROLLBACK TO SAVEPOINT audit_payment_credential_writer_failure;

ROLLBACK;
