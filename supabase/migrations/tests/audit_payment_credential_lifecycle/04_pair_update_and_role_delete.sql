
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
