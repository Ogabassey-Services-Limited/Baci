-- C1 authorization non-disclosure regression. Run only against a disposable
-- full-history replay database. All fixtures are rolled back.
-- The private schema has shared RPCs elsewhere in the history, so this test
-- intentionally asserts table/function ACLs rather than revoking schema USAGE
-- globally for anon/authenticated.
BEGIN;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-4000-a100-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-auth-owner@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-a100-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-auth-platform@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-a100-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-auth-inactive@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-a100-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-auth-dual@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

SELECT set_config(
  'app.audit_actor_user_id',
  '00000000-0000-4000-a100-000000000001',
  true
);

INSERT INTO public.merchants (id, user_id, email, business_name, slug, is_platform_admin) VALUES
  ('00000000-0000-4000-b100-000000000001', '00000000-0000-4000-a100-000000000001', 'c1-auth-owner-merchant@example.test', 'C1 Auth Owner', 'c1-auth-owner', false),
  ('00000000-0000-4000-b100-000000000002', '00000000-0000-4000-a100-000000000002', 'c1-auth-platform-merchant@example.test', 'C1 Auth Platform', 'c1-auth-platform', true),
  ('00000000-0000-4000-b100-000000000004', '00000000-0000-4000-a100-000000000004', 'c1-auth-dual-merchant@example.test', 'C1 Auth Dual', 'c1-auth-dual', true);

INSERT INTO public.staff_members (merchant_id, user_id, email, name, status)
VALUES ('00000000-0000-4000-b100-000000000001', '00000000-0000-4000-a100-000000000003', 'c1-auth-inactive@example.test', 'C1 Auth Inactive', 'suspended');

INSERT INTO public.products (id, merchant_id, name, price, description, status) VALUES
  ('00000000-0000-4000-c100-000000000001', '00000000-0000-4000-b100-000000000001', 'C1 authorization product', 100, 'C1 exact old bytes', 'draft'),
  ('00000000-0000-4000-c100-000000000002', '00000000-0000-4000-b100-000000000002', 'C1 authorization other product', 100, 'C1 other bytes', 'draft');


DO $$
DECLARE
  privilege_name text;
  function_config text[];
  product_policies text[];
  attestation_owner text;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.product_description_attestation_grants'::regclass) THEN
    RAISE EXCEPTION 'C1 attestation grants must retain RLS';
  END IF;

  SELECT pg_catalog.pg_get_userbyid(relowner) INTO attestation_owner
  FROM pg_class
  WHERE oid = 'private.product_description_attestation_grants'::regclass;
  IF attestation_owner IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'C1 attestation grants must remain owned by postgres';
  END IF;

  FOR privilege_name IN SELECT unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'])
  LOOP
    IF has_table_privilege('anon', 'private.product_description_attestation_grants', privilege_name)
      OR has_table_privilege('authenticated', 'private.product_description_attestation_grants', privilege_name) THEN
      RAISE EXCEPTION 'C1 direct table privilege unexpectedly granted: %', privilege_name;
    END IF;
  END LOOP;

  SELECT proconfig INTO function_config
  FROM pg_proc
  WHERE oid = 'public.request_product_description_attestation_grant(uuid,uuid,uuid,text,text,text,text,boolean,text)'::regprocedure;
  IF function_config IS DISTINCT FROM ARRAY['search_path=""']::text[]
    OR EXISTS (
      SELECT 1
      FROM pg_proc AS procedure, pg_catalog.aclexplode(procedure.proacl) AS acl
      WHERE procedure.oid = 'public.request_product_description_attestation_grant(uuid,uuid,uuid,text,text,text,text,boolean,text)'::regprocedure
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    )
    OR has_function_privilege('anon', 'public.request_product_description_attestation_grant(uuid,uuid,uuid,text,text,text,text,boolean,text)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.request_product_description_attestation_grant(uuid,uuid,uuid,text,text,text,text,boolean,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'C1 function ACL or fixed empty search_path is incorrect';
  END IF;

  SELECT array_agg(policy.polname ORDER BY policy.polname) INTO product_policies
  FROM pg_policy AS policy
  WHERE policy.polrelid = 'public.products'::regclass;
  IF product_policies IS DISTINCT FROM ARRAY['products_delete_policy', 'products_insert_policy', 'products_select_policy', 'products_update_policy']::text[] THEN
    RAISE EXCEPTION 'C1 must preserve the exact public.products policy set';
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a100-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  test_case record;
  first_error text;
  accepted_case text;
BEGIN
  FOR test_case IN
    SELECT * FROM (VALUES
      ('existing', '00000000-0000-4000-c100-000000000001'::uuid, '00000000-0000-4000-d100-000000000001'::uuid, 'C1 exact old bytes'::text),
      ('missing', '00000000-0000-4000-c100-000000000099'::uuid, '00000000-0000-4000-d100-000000000002'::uuid, 'C1 exact old bytes'::text),
      ('wrong_merchant', '00000000-0000-4000-c100-000000000002'::uuid, '00000000-0000-4000-d100-000000000003'::uuid, 'C1 other bytes'::text),
      ('wrong_old', '00000000-0000-4000-c100-000000000001'::uuid, '00000000-0000-4000-d100-000000000004'::uuid, 'wrong old bytes'::text)
    ) AS cases(case_name, product_id, operation_id, expected_old_description)
  LOOP
    accepted_case := NULL;
    BEGIN
      PERFORM public.request_product_description_attestation_grant(
        '00000000-0000-4000-b100-000000000001',
        test_case.product_id,
        test_case.operation_id,
        test_case.expected_old_description,
        NULL,
        NULL,
        repeat('a', 64),
        true,
        'manual_description'
      );
      accepted_case := test_case.case_name;
    EXCEPTION WHEN raise_exception THEN
      IF accepted_case IS NULL THEN
        IF first_error IS NULL THEN
          first_error := SQLERRM;
        ELSIF SQLERRM <> first_error THEN
          RAISE EXCEPTION 'unauthorized requests leaked product state: % != %', SQLERRM, first_error;
        END IF;
      END IF;
    END;
    IF accepted_case IS NOT NULL THEN
      RAISE EXCEPTION 'unauthorized % request was accepted', accepted_case;
    END IF;
  END LOOP;

  IF first_error IS DISTINCT FROM 'product_description_attestation_merchant_authority_required' THEN
    RAISE EXCEPTION 'unauthorized outward contract must be merchant authority, got %', first_error;
  END IF;
END;
$$ LANGUAGE plpgsql;

RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a100-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.request_product_description_attestation_grant(
      '00000000-0000-4000-b100-000000000001',
      '00000000-0000-4000-c100-000000000099',
      '00000000-0000-4000-d100-000000000099',
      NULL, NULL, NULL, repeat('b', 64), false, 'manual_description'
    );
    RAISE EXCEPTION 'inactive staff caller-generated UUID was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'product_description_attestation_merchant_authority_required' THEN RAISE; END IF;
  END;
END;
$$ LANGUAGE plpgsql;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a100-000000000004","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_grant uuid;
BEGIN
  SELECT grant_id INTO v_grant
  FROM public.request_product_description_attestation_grant(
    '00000000-0000-4000-b100-000000000004',
    '00000000-0000-4000-c100-000000000099',
    '00000000-0000-4000-d100-000000000100',
    NULL, NULL, NULL, repeat('c', 64), false, 'manual_description'
  );
  IF v_grant IS NULL THEN
    RAISE EXCEPTION 'dual-role merchant authority did not succeed';
  END IF;
END;
$$ LANGUAGE plpgsql;
RESET ROLE;
ROLLBACK;
