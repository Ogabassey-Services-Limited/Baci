-- C1 schema and fixture setup.

DO $$
DECLARE
  source_column record;
  hash_column record;
  product_acl text;
  function_acl text;
  cleanup_function_acl text;
  attestation_owner text;
  evidence_owner text;
  evidence_acl text;
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

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname IN (
        'products_description_digital_source_type_check',
        'products_description_provenance_sha256_check'
      )
      AND NOT convalidated
  ) THEN
    RAISE EXCEPTION 'C1 provenance constraints must be validated';
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

  SELECT pg_catalog.pg_get_userbyid(relowner) INTO attestation_owner
  FROM pg_class
  WHERE oid = 'private.product_description_attestation_grants'::regclass;
  IF attestation_owner IS DISTINCT FROM 'postgres'
    OR NOT EXISTS (
      SELECT 1
      FROM pg_class
      WHERE oid = 'private.product_description_attestation_grants_merchant_id_idx'::regclass
    )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_class
      WHERE oid = 'private.product_description_attestation_grants_actor_id_idx'::regclass
    ) THEN
    RAISE EXCEPTION 'C1 attestation grant ownership or supporting indexes are incorrect';
  END IF;

  SELECT pg_catalog.pg_get_userbyid(relowner), relacl::text
    INTO evidence_owner, evidence_acl
  FROM pg_class
  WHERE oid = 'private.product_description_attestation_grant_evidence'::regclass;
  IF evidence_owner IS DISTINCT FROM 'postgres'
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.product_description_attestation_grant_evidence'::regclass)
    OR has_table_privilege('anon', 'private.product_description_attestation_grant_evidence', 'SELECT')
    OR has_table_privilege('authenticated', 'private.product_description_attestation_grant_evidence', 'SELECT')
    OR NOT has_table_privilege('service_role', 'private.product_description_attestation_grant_evidence', 'SELECT')
    OR has_table_privilege('service_role', 'private.product_description_attestation_grant_evidence', 'INSERT')
    OR has_table_privilege('service_role', 'private.product_description_attestation_grant_evidence', 'UPDATE')
    OR has_table_privilege('service_role', 'private.product_description_attestation_grant_evidence', 'DELETE') THEN
    RAISE EXCEPTION 'C1 terminal attestation evidence ownership, RLS, or ACLs are incorrect: %', evidence_acl;
  END IF;

  SELECT proacl::text INTO cleanup_function_acl
  FROM pg_proc
  WHERE oid = 'private.cleanup_product_description_attestation_grants(integer)'::regprocedure;
  IF cleanup_function_acl IS NULL
    OR has_function_privilege('anon', 'private.cleanup_product_description_attestation_grants(integer)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'private.cleanup_product_description_attestation_grants(integer)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'private.cleanup_product_description_attestation_grants(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'C1 retention function must be service-role-only';
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
  ('00000000-0000-4000-c000-000000000103', '00000000-0000-4000-b000-000000000102', 'C1 foreign product', 100, 'foreign exact bytes', 'draft'),
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
