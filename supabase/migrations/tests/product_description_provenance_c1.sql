-- C1 migration regression contract. Run only against a disposable full-history
-- replay database. All fixtures are rolled back.
BEGIN;

DO $$
DECLARE
  source_column record;
  hash_column record;
  product_acl text;
  function_acl text;
BEGIN
  SELECT column_name, is_nullable INTO source_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name = 'description_digital_source_type';
  SELECT column_name, is_nullable INTO hash_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name = 'description_provenance_sha256';

  IF source_column.column_name IS NULL OR source_column.is_nullable <> 'YES'
    OR hash_column.column_name IS NULL OR hash_column.is_nullable <> 'YES' THEN
    RAISE EXCEPTION 'C1 provenance columns must be additive nullable columns';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_description_digital_source_type_check'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_description_provenance_sha256_check'
  ) THEN
    RAISE EXCEPTION 'C1 provenance constraints are missing';
  END IF;

  SELECT relacl::text INTO product_acl
  FROM pg_class WHERE oid = 'public.products'::regclass;
  IF product_acl IS NULL THEN
    RAISE EXCEPTION 'C1 must not clear existing public.products grants';
  END IF;

  SELECT proacl::text INTO function_acl
  FROM pg_proc
  WHERE oid = 'public.request_product_description_attestation_grant(uuid,uuid,uuid,text,text,text,text,boolean,text)'::regprocedure;
  IF function_acl IS NULL
    OR has_function_privilege('anon', 'public.request_product_description_attestation_grant(uuid,uuid,uuid,text,text,text,text,boolean,text)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.request_product_description_attestation_grant(uuid,uuid,uuid,text,text,text,text,boolean,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'C1 RPC grants must be authenticated-only';
  END IF;

  IF has_table_privilege('authenticated', 'private.product_description_attestation_grants', 'SELECT')
    OR has_table_privilege('authenticated', 'private.product_description_attestation_grants', 'INSERT')
    OR has_table_privilege('anon', 'private.product_description_attestation_grants', 'SELECT') THEN
    RAISE EXCEPTION 'C1 attestation grants must deny direct anonymous/authenticated table access';
  END IF;
END;
$$ LANGUAGE plpgsql;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-4000-a000-000000000101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-owner@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-a000-000000000102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-staff@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-a000-000000000103', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-stranger@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-a000-000000000104', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-platform@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-a000-000000000105', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-dual@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

SELECT set_config(
  'app.audit_actor_user_id',
  '00000000-0000-4000-a000-000000000101',
  true
);

INSERT INTO public.merchants (id, user_id, email, business_name, slug, is_platform_admin) VALUES
  ('00000000-0000-4000-b000-000000000101', '00000000-0000-4000-a000-000000000101', 'c1-owner-merchant@example.test', 'C1 Owner', 'c1-owner', false),
  ('00000000-0000-4000-b000-000000000102', '00000000-0000-4000-a000-000000000103', 'c1-stranger-merchant@example.test', 'C1 Stranger', 'c1-stranger', false),
  ('00000000-0000-4000-b000-000000000104', '00000000-0000-4000-a000-000000000104', 'c1-platform-merchant@example.test', 'C1 Platform', 'c1-platform', true),
  ('00000000-0000-4000-b000-000000000105', '00000000-0000-4000-a000-000000000105', 'c1-dual-merchant@example.test', 'C1 Dual', 'c1-dual', true);

INSERT INTO public.staff_members (merchant_id, user_id, email, name, status)
VALUES ('00000000-0000-4000-b000-000000000101', '00000000-0000-4000-a000-000000000102', 'c1-staff@example.test', 'C1 Staff', 'active');

INSERT INTO public.products (id, merchant_id, name, price, description, status) VALUES
  ('00000000-0000-4000-c000-000000000101', '00000000-0000-4000-b000-000000000101', 'C1 legacy product', 100, 'legacy exact bytes', 'draft'),
  ('00000000-0000-4000-c000-000000000102', '00000000-0000-4000-b000-000000000101', 'C1 default product', 100, 'current default bytes', 'draft'),
  ('00000000-0000-4000-c000-000000000105', '00000000-0000-4000-b000-000000000105', 'C1 dual product', 100, 'dual exact bytes', 'draft');

UPDATE public.products
SET description_digital_source_type = 'default',
    description_provenance_sha256 = repeat('0', 64)
WHERE id = '00000000-0000-4000-c000-000000000102';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = '00000000-0000-4000-c000-000000000101'
      AND description = 'legacy exact bytes'
      AND description_digital_source_type IS NULL
      AND description_provenance_sha256 IS NULL
  ) THEN
    RAISE EXCEPTION 'C1 must preserve legacy description bytes with NULL provenance';
  END IF;

  BEGIN
    UPDATE public.products SET description_digital_source_type = 'invalid'
    WHERE id = '00000000-0000-4000-c000-000000000101';
    RAISE EXCEPTION 'invalid digital source was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.products SET description_provenance_sha256 = 'ABC'
    WHERE id = '00000000-0000-4000-c000-000000000101';
    RAISE EXCEPTION 'invalid provenance SHA-256 was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$$ LANGUAGE plpgsql;

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
  SELECT grant_id INTO v_grant FROM public.request_product_description_attestation_grant(
    '00000000-0000-4000-b000-000000000101','00000000-0000-4000-c000-000000000199','00000000-0000-4000-d000-000000000107',NULL,NULL,NULL,repeat('1',64),true,'manual_description');
  IF v_grant IS NULL THEN RAISE EXCEPTION 'active staff new-product authority did not succeed'; END IF;
END;
$$ LANGUAGE plpgsql;
RESET ROLE;

ROLLBACK;
