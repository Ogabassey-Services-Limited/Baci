
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
