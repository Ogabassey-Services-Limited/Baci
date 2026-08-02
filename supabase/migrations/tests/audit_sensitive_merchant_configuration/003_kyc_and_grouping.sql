-- The real KYC RPCs write merchants internally. Their sensitive updates must
-- still become redacted audit events without route-supplied audit metadata.
INSERT INTO audit_sensitive_event_counts
SELECT 'nin-before', count(*)
FROM public.audit_events
WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
  AND metadata ->> 'category' = 'merchant_configuration';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e3f2e40-0000-4000-8000-000000000001', true);
SELECT public.record_nin_verification(
  '7e3f2e40-0000-4000-8000-000000000002', 'task4-nin-rpc-sentinel',
  'Audit', 'Owner', '1990-01-01'::date
);
SELECT public.record_bvn_verification(
  '7e3f2e40-0000-4000-8000-000000000002', 'task4-bvn-rpc-sentinel',
  'Audit', 'Owner', '1990-01-01'::date
);
RESET ROLE;

DO $test$
DECLARE v_new_events record; v_before_count integer; v_after_count integer; v_audit_text text;
BEGIN
  SELECT event_count INTO v_before_count FROM audit_sensitive_event_counts WHERE label = 'nin-before';
  SELECT count(*) INTO v_after_count FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_configuration';
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002';
  SELECT * INTO v_new_events FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND metadata ->> 'category' = 'merchant_configuration'
  ORDER BY occurred_at DESC, id DESC LIMIT 1;
  IF v_after_count <> v_before_count + 2
     OR NOT (v_new_events.changed_fields && ARRAY['nin', 'bvn']::text[])
     OR v_new_events.after_values -> 'bvn' IS DISTINCT FROM
       '{"present":true,"state":"rotated"}'::jsonb
     OR NOT EXISTS (
       SELECT 1
       FROM public.audit_events AS audit_event
       WHERE audit_event.merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
         AND audit_event.metadata ->> 'category' = 'merchant_configuration'
         AND audit_event.after_values -> 'nin' =
           '{"present":true,"state":"rotated"}'::jsonb
     )
     OR position('task4-nin-rpc-sentinel' in coalesce(v_audit_text, '')) > 0
     OR position('task4-bvn-rpc-sentinel' in coalesce(v_audit_text, '')) > 0 THEN
    RAISE EXCEPTION 'NIN/BVN verification RPCs did not emit safely redacted events';
  END IF;
END;
$test$;
-- A CAC verification is one logical merchant update that spans the Task 2
-- public-identity allowlist and Task 4 sensitive allowlist. It must yield
-- precisely two events that share a writer-generated transaction identifier.
DO $test$
DECLARE
  v_before_ids uuid[];
  v_new_event_count integer;
  v_new_transaction_count integer;
  v_identity_count integer;
  v_configuration_count integer;
  v_configuration_cac_state jsonb;
  v_audit_text text;
BEGIN
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
    INTO v_before_ids
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002';

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '7e3f2e40-0000-4000-8000-000000000001', true);
  PERFORM public.record_cac_verification(
    '7e3f2e40-0000-4000-8000-000000000002',
    'https://task4-certificate-sentinel.example/cac.pdf',
    'Sensitive Merchant Audit Limited',
    'task4-cac-rpc-sentinel'
  );
  RESET ROLE;

  SELECT count(*), count(DISTINCT database_transaction_id),
         count(*) FILTER (WHERE metadata ->> 'category' = 'merchant_identity'),
         count(*) FILTER (WHERE metadata ->> 'category' = 'merchant_configuration')
    INTO v_new_event_count, v_new_transaction_count, v_identity_count,
         v_configuration_count
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND id <> ALL(v_before_ids);
  SELECT after_values -> 'cac_rc_number'
    INTO v_configuration_cac_state
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND id <> ALL(v_before_ids)
    AND metadata ->> 'category' = 'merchant_configuration';
  SELECT string_agg(pg_catalog.to_jsonb(audit_event)::text, E'\n') INTO v_audit_text
  FROM public.audit_events AS audit_event
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002';

  IF v_new_event_count <> 2
     OR v_new_transaction_count <> 1
     OR v_identity_count <> 1
     OR v_configuration_count <> 1
     OR v_configuration_cac_state IS DISTINCT FROM
       '{"present":true,"state":"rotated"}'::jsonb
     OR position('task4-cac-rpc-sentinel' in coalesce(v_audit_text, '')) > 0
     OR position('task4-certificate-sentinel' in coalesce(v_audit_text, '')) > 0 THEN
    RAISE EXCEPTION 'CAC verification did not yield exactly two safely grouped cross-domain events';
  END IF;
END;
$test$;
-- Direct changes spanning a public Task 2 field and a Task 4 field likewise
-- remain one event per domain and share the database transaction identifier.
DO $test$
DECLARE
  v_before_ids uuid[];
  v_new_event_count integer;
  v_new_transaction_count integer;
  v_identity_count integer;
  v_configuration_count integer;
BEGIN
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
    INTO v_before_ids
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002';

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '7e3f2e40-0000-4000-8000-000000000001', true);
  UPDATE public.merchants
  SET site_title = 'Task 4 cross-domain title', payout_currency = 'EUR'
  WHERE id = '7e3f2e40-0000-4000-8000-000000000002';
  RESET ROLE;

  SELECT count(*), count(DISTINCT database_transaction_id),
         count(*) FILTER (WHERE metadata ->> 'category' = 'merchant_identity'),
         count(*) FILTER (WHERE metadata ->> 'category' = 'merchant_configuration')
    INTO v_new_event_count, v_new_transaction_count, v_identity_count,
         v_configuration_count
  FROM public.audit_events
  WHERE merchant_id = '7e3f2e40-0000-4000-8000-000000000002'
    AND id <> ALL(v_before_ids);

  IF v_new_event_count <> 2
     OR v_new_transaction_count <> 1
     OR v_identity_count <> 1
     OR v_configuration_count <> 1 THEN
    RAISE EXCEPTION 'cross-domain merchant update did not yield exactly two grouped events';
  END IF;
END;
$test$;
