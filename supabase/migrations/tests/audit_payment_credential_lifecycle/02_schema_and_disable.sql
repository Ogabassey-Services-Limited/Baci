
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
