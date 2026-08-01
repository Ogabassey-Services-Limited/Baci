-- C1 issuance-budget contract, including archived evidence.

-- The issuance budget must include archived evidence, not only live grants.
-- Otherwise an actor can issue a fresh operation for every cleanup cycle and
-- keep the short-lived grant table bounded while still creating an unbounded
-- audit trail.
INSERT INTO private.product_description_attestation_grant_evidence (
  id,
  merchant_id,
  product_id,
  actor_id,
  operation_id,
  expected_old_description,
  expected_old_source_type,
  expected_old_sha256,
  proposed_description_sha256,
  full_replacement,
  purpose,
  created_at,
  expires_at,
  consumed_at
)
SELECT
  extensions.gen_random_uuid(),
  '00000000-0000-4000-b000-000000000101',
  '00000000-0000-4000-c000-000000000101',
  '00000000-0000-4000-a000-000000000101',
  extensions.gen_random_uuid(),
  'issuance budget fixture',
  'default',
  repeat('7', 64),
  repeat('8', 64),
  true,
  'manual_description',
  pg_catalog.clock_timestamp(),
  pg_catalog.clock_timestamp() + interval '15 minutes',
  NULL
FROM generate_series(1, 1000);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000101","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.request_product_description_attestation_grant(
      '00000000-0000-4000-b000-000000000101',
      '00000000-0000-4000-c000-000000000101',
      '00000000-0000-4000-d000-000000000113',
      'legacy exact bytes', NULL, NULL,
      repeat('9', 64), true, 'manual_description'
    );
    RAISE EXCEPTION 'attestation issuance exceeded the merchant budget';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'product_description_attestation_issuance_rate_limited' THEN
      RAISE;
    END IF;
  END;
END;
$$ LANGUAGE plpgsql;
RESET ROLE;
