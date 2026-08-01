-- C1 authorization and replay contract.

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000101","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  first_grant uuid;
  replay_grant uuid;
BEGIN
  SELECT grant_id INTO first_grant
  FROM public.request_product_description_attestation_grant(
    '00000000-0000-4000-b000-000000000101',
    '00000000-0000-4000-c000-000000000101',
    '00000000-0000-4000-d000-000000000101',
    'legacy exact bytes', NULL, NULL,
    repeat('a', 64), true, 'manual_description'
  );

  SELECT grant_id INTO replay_grant
  FROM public.request_product_description_attestation_grant(
    '00000000-0000-4000-b000-000000000101',
    '00000000-0000-4000-c000-000000000101',
    '00000000-0000-4000-d000-000000000101',
    'legacy exact bytes', NULL, NULL,
    repeat('a', 64), true, 'manual_description'
  );

  IF first_grant IS NULL OR replay_grant IS DISTINCT FROM first_grant THEN
    RAISE EXCEPTION 'byte-identical operation replay must be idempotent';
  END IF;

  BEGIN
    PERFORM public.request_product_description_attestation_grant(
      '00000000-0000-4000-b000-000000000101',
      '00000000-0000-4000-c000-000000000101',
      '00000000-0000-4000-d000-000000000101',
      'legacy exact bytes', NULL, NULL,
      repeat('b', 64), true, 'manual_description'
    );
    RAISE EXCEPTION 'changed binding replay was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'product_description_attestation_operation_binding_mismatch' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.request_product_description_attestation_grant(
      '00000000-0000-4000-b000-000000000101',
      '00000000-0000-4000-c000-000000000101',
      '00000000-0000-4000-d000-000000000102',
      'wrong old bytes', NULL, NULL,
      repeat('a', 64), true, 'manual_description'
    );
    RAISE EXCEPTION 'mismatched expected-old triple was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'product_description_attestation_expected_old_mismatch' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.request_product_description_attestation_grant(
      '00000000-0000-4000-b000-000000000101',
      '00000000-0000-4000-c000-000000000103',
      '00000000-0000-4000-d000-000000000103',
      'foreign exact bytes', NULL, NULL,
      repeat('a', 64), true, 'manual_description'
    );
    RAISE EXCEPTION 'foreign product state was disclosed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'product_description_attestation_expected_old_mismatch' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.request_product_description_attestation_grant(
      '00000000-0000-4000-b000-000000000101',
      '00000000-0000-4000-c000-000000009999',
      '00000000-0000-4000-d000-000000000104',
      'missing product old bytes', NULL, NULL,
      repeat('a', 64), true, 'manual_description'
    );
    RAISE EXCEPTION 'missing product state was disclosed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'product_description_attestation_expected_old_mismatch' THEN RAISE; END IF;
  END;
END;
$$ LANGUAGE plpgsql;

-- A null expected-old triple is the caller-generated-product flow. Existing
-- foreign IDs and absent IDs intentionally share the same successful outcome,
-- so this request cannot be used to enumerate product ownership.
DO $$
DECLARE
  foreign_grant uuid;
  missing_grant uuid;
BEGIN
  SELECT grant_id INTO foreign_grant
  FROM public.request_product_description_attestation_grant(
    '00000000-0000-4000-b000-000000000101',
    '00000000-0000-4000-c000-000000000103',
    '00000000-0000-4000-d000-000000000109',
    NULL, NULL, NULL, repeat('b', 64), true, 'manual_description'
  );

  SELECT grant_id INTO missing_grant
  FROM public.request_product_description_attestation_grant(
    '00000000-0000-4000-b000-000000000101',
    '00000000-0000-4000-c000-000000009998',
    '00000000-0000-4000-d000-00000000010a',
    NULL, NULL, NULL, repeat('b', 64), true, 'manual_description'
  );

  IF foreign_grant IS NULL OR missing_grant IS NULL THEN
    RAISE EXCEPTION 'null expected-old foreign and missing product outcomes differ';
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  first_grant uuid;
  replay_grant uuid;
BEGIN
  SELECT grant_id INTO first_grant
  FROM public.request_product_description_attestation_grant(
    '00000000-0000-4000-b000-000000000101',
    '00000000-0000-4000-c000-000000000102',
    '00000000-0000-4000-d000-000000000108',
    'current default bytes', 'default', repeat('0', 64),
    repeat('2', 64), false, 'manual_description'
  );

  SELECT grant_id INTO replay_grant
  FROM public.request_product_description_attestation_grant(
    '00000000-0000-4000-b000-000000000101',
    '00000000-0000-4000-c000-000000000102',
    '00000000-0000-4000-d000-000000000108',
    'current default bytes', 'default', repeat('0', 64),
    repeat('2', 64), false, 'manual_description'
  );

  IF first_grant IS NULL OR replay_grant IS DISTINCT FROM first_grant THEN
    RAISE EXCEPTION 'full_replacement=false binding must be idempotent';
  END IF;
END;
$$ LANGUAGE plpgsql;

RESET ROLE;
UPDATE private.product_description_attestation_grants
SET created_at = pg_catalog.clock_timestamp() - interval '3 minutes',
    expires_at = pg_catalog.clock_timestamp() - interval '2 minutes'
WHERE operation_id = '00000000-0000-4000-d000-000000000101';

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000101","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.request_product_description_attestation_grant(
      '00000000-0000-4000-b000-000000000101',
      '00000000-0000-4000-c000-000000000101',
      '00000000-0000-4000-d000-000000000101',
      'legacy exact bytes', NULL, NULL,
      repeat('a', 64), true, 'manual_description'
    );
    RAISE EXCEPTION 'expired grant replay was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'product_description_attestation_grant_expired' THEN RAISE; END IF;
  END;
END;
$$ LANGUAGE plpgsql;
RESET ROLE;

-- Cross-merchant, platform-admin-only, unauthenticated, and dual-role checks.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000103","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.request_product_description_attestation_grant('00000000-0000-4000-b000-000000000101','00000000-0000-4000-c000-000000000101','00000000-0000-4000-d000-000000000103','legacy exact bytes',NULL,NULL,repeat('c',64),true,'manual_description');
    RAISE EXCEPTION 'cross-merchant caller was accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'product_description_attestation_merchant_authority_required' THEN RAISE; END IF; END;
END $$ LANGUAGE plpgsql;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000104","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.request_product_description_attestation_grant('00000000-0000-4000-b000-000000000101','00000000-0000-4000-c000-000000000101','00000000-0000-4000-d000-000000000104','legacy exact bytes',NULL,NULL,repeat('d',64),true,'manual_description');
    RAISE EXCEPTION 'platform-admin-only caller was accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'product_description_attestation_merchant_authority_required' THEN RAISE; END IF; END;
END $$ LANGUAGE plpgsql;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.request_product_description_attestation_grant('00000000-0000-4000-b000-000000000101','00000000-0000-4000-c000-000000000101','00000000-0000-4000-d000-000000000105','legacy exact bytes',NULL,NULL,repeat('e',64),true,'manual_description');
    RAISE EXCEPTION 'unauthenticated caller was accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'product_description_attestation_unauthenticated' THEN RAISE; END IF; END;
END $$ LANGUAGE plpgsql;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000105","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_grant uuid;
BEGIN
  SELECT grant_id INTO v_grant FROM public.request_product_description_attestation_grant(
    '00000000-0000-4000-b000-000000000105','00000000-0000-4000-c000-000000000105','00000000-0000-4000-d000-000000000106','dual exact bytes',NULL,NULL,repeat('f',64),true,'manual_description');
  IF v_grant IS NULL THEN RAISE EXCEPTION 'dual-role merchant authority did not succeed'; END IF;
END;
$$ LANGUAGE plpgsql;
RESET ROLE;

-- A new caller-generated product UUID needs explicit merchant/staff authority.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000102","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_grant uuid;
BEGIN
  BEGIN
    PERFORM public.request_product_description_attestation_grant(
      '00000000-0000-4000-b000-000000000101',
      '00000000-0000-4000-c000-000000000199',
      '00000000-0000-4000-d000-000000000107',
      NULL, NULL, NULL, repeat('1',64), true, 'manual_description');
    RAISE EXCEPTION 'view-only staff received create authority';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'product_description_attestation_merchant_authority_required' THEN RAISE; END IF;
  END;
END;
$$ LANGUAGE plpgsql;
RESET ROLE;

-- Grant only the product-create permission explicitly, leaving the default
-- sales_rep role view-only so the preceding denial remains a behavioral check.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000101","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
UPDATE public.staff_members
SET permissions = '{"products":{"create":true}}'::jsonb
WHERE merchant_id = '00000000-0000-4000-b000-000000000101'
  AND user_id = '00000000-0000-4000-a000-000000000102';
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000102","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_grant uuid;
BEGIN
  SELECT grant_id INTO v_grant FROM public.request_product_description_attestation_grant(
    '00000000-0000-4000-b000-000000000101','00000000-0000-4000-c000-000000000199','00000000-0000-4000-d000-000000000107',NULL,NULL,NULL,repeat('1',64),true,'manual_description');
  IF v_grant IS NULL THEN RAISE EXCEPTION 'active staff new-product authority did not succeed'; END IF;
END;
$$ LANGUAGE plpgsql;
RESET ROLE;
