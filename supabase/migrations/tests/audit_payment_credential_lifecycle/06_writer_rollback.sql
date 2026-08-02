
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
