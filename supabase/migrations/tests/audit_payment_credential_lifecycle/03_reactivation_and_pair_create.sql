
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
