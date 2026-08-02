-- C1 retention and operation-binding contract.

-- Terminal grants are archived before active rows are reclaimed; exact actor
-- and byte bindings remain available as immutable evidence.
INSERT INTO private.product_description_attestation_grants (
  id, merchant_id, product_id, actor_id, operation_id,
  expected_old_description, expected_old_source_type, expected_old_sha256,
  proposed_description_sha256, full_replacement, purpose,
  created_at, expires_at, consumed_at
) VALUES
  (
    '00000000-0000-4000-e000-000000000110',
    '00000000-0000-4000-b000-000000000101',
    '00000000-0000-4000-c000-000000000101',
    '00000000-0000-4000-a000-000000000101',
    '00000000-0000-4000-d000-000000000110',
    'expired evidence bytes', 'default', repeat('1', 64), repeat('2', 64),
    true, 'manual_description',
    pg_catalog.clock_timestamp() - interval '3 minutes',
    pg_catalog.clock_timestamp() - interval '2 minutes',
    NULL
  ),
  (
    '00000000-0000-4000-e000-000000000111',
    '00000000-0000-4000-b000-000000000101',
    '00000000-0000-4000-c000-000000000101',
    '00000000-0000-4000-a000-000000000101',
    '00000000-0000-4000-d000-000000000111',
    'consumed evidence bytes', 'default', repeat('3', 64), repeat('4', 64),
    true, 'manual_description',
    pg_catalog.clock_timestamp() - interval '3 minutes',
    pg_catalog.clock_timestamp() + interval '10 minutes',
    pg_catalog.clock_timestamp()
  ),
  (
    '00000000-0000-4000-e000-000000000112',
    '00000000-0000-4000-b000-000000000101',
    '00000000-0000-4000-c000-000000000101',
    '00000000-0000-4000-a000-000000000101',
    '00000000-0000-4000-d000-000000000112',
    'legacy exact bytes', NULL, NULL, repeat('5', 64),
    true, 'manual_description',
    pg_catalog.clock_timestamp() - interval '3 minutes',
    pg_catalog.clock_timestamp() - interval '2 minutes',
    NULL
  );

SET LOCAL ROLE service_role;
DO $$
DECLARE
  archived_count integer;
BEGIN
  SELECT private.cleanup_product_description_attestation_grants(10)
    INTO archived_count;
  IF archived_count <> 4 THEN
    RAISE EXCEPTION 'C1 retention must archive four terminal grants, got %', archived_count;
  END IF;
END;
$$ LANGUAGE plpgsql;
RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM private.product_description_attestation_grants
    WHERE operation_id IN (
      '00000000-0000-4000-d000-000000000101',
      '00000000-0000-4000-d000-000000000110',
      '00000000-0000-4000-d000-000000000111',
      '00000000-0000-4000-d000-000000000112'
    )
  ) OR (
    SELECT count(*)
    FROM private.product_description_attestation_grant_evidence
    WHERE operation_id IN (
      '00000000-0000-4000-d000-000000000101',
      '00000000-0000-4000-d000-000000000110',
      '00000000-0000-4000-d000-000000000111',
      '00000000-0000-4000-d000-000000000112'
    )
  ) <> 4 OR NOT EXISTS (
    SELECT 1
    FROM private.product_description_attestation_grant_evidence
    WHERE operation_id = '00000000-0000-4000-d000-000000000110'
      AND actor_id = '00000000-0000-4000-a000-000000000101'
      AND expected_old_description = 'expired evidence bytes'
      AND expected_old_sha256 = repeat('1', 64)
  ) OR NOT EXISTS (
    SELECT 1
    FROM private.product_description_attestation_grant_evidence
    WHERE operation_id = '00000000-0000-4000-d000-000000000111'
      AND actor_id = '00000000-0000-4000-a000-000000000101'
      AND expected_old_description = 'consumed evidence bytes'
      AND expected_old_sha256 = repeat('3', 64)
  ) OR NOT EXISTS (
    SELECT 1
    FROM private.product_description_attestation_grant_evidence
    WHERE operation_id = '00000000-0000-4000-d000-000000000101'
      AND actor_id = '00000000-0000-4000-a000-000000000101'
      AND expected_old_description = 'legacy exact bytes'
      AND expected_old_sha256 IS NULL
  ) THEN
    RAISE EXCEPTION 'C1 terminal grant evidence was not retained exactly';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- An archived operation ID remains terminal and cannot be rebound after the
-- active grant row is reclaimed. The third fixture intentionally matches the
-- current product state so the pre-fix RPC would create a replacement grant.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000101","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.request_product_description_attestation_grant(
      '00000000-0000-4000-b000-000000000101',
      '00000000-0000-4000-c000-000000000101',
      '00000000-0000-4000-d000-000000000112',
      'legacy exact bytes', NULL, NULL,
      repeat('5', 64), true, 'manual_description'
    );
    RAISE EXCEPTION 'archived expired operation replay was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'product_description_attestation_grant_expired' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.request_product_description_attestation_grant(
      '00000000-0000-4000-b000-000000000101',
      '00000000-0000-4000-c000-000000000101',
      '00000000-0000-4000-d000-000000000112',
      'legacy exact bytes', NULL, NULL,
      repeat('6', 64), true, 'manual_description'
    );
    RAISE EXCEPTION 'archived operation binding reuse was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'product_description_attestation_operation_binding_mismatch' THEN RAISE; END IF;
  END;
END;
$$ LANGUAGE plpgsql;
RESET ROLE;
