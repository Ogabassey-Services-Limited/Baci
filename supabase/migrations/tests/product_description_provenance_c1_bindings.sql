-- C1 immutable-binding and terminal-state contract. Disposable replay only.
BEGIN;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-4000-a200-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-binding-owner@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-a200-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-binding-staff@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

SELECT set_config(
  'app.audit_actor_user_id',
  '00000000-0000-4000-a200-000000000001',
  true
);

INSERT INTO public.merchants (id, user_id, email, business_name, slug) VALUES
  ('00000000-0000-4000-b200-000000000001', '00000000-0000-4000-a200-000000000001', 'c1-binding-one@example.test', 'C1 Binding One', 'c1-binding-one'),
  ('00000000-0000-4000-b200-000000000002', '00000000-0000-4000-a200-000000000002', 'c1-binding-two@example.test', 'C1 Binding Two', 'c1-binding-two');

INSERT INTO public.staff_members (merchant_id, user_id, email, name, status)
VALUES
  ('00000000-0000-4000-b200-000000000001', '00000000-0000-4000-a200-000000000002', 'c1-binding-staff@example.test', 'C1 Binding Staff', 'active'),
  ('00000000-0000-4000-b200-000000000002', '00000000-0000-4000-a200-000000000001', 'c1-binding-owner@example.test', 'C1 Binding Owner Staff', 'active');

INSERT INTO public.products (
  id, merchant_id, name, price, description, status,
  description_digital_source_type, description_provenance_sha256
) VALUES
  ('00000000-0000-4000-c200-000000000001', '00000000-0000-4000-b200-000000000001', 'C1 binding primary', 100, 'C1 binding old bytes', 'draft', 'default', repeat('0', 64)),
  ('00000000-0000-4000-c200-000000000002', '00000000-0000-4000-b200-000000000001', 'C1 binding alternate', 100, 'C1 binding alternate bytes', 'draft', 'default', repeat('0', 64));

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a200-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE v_grant uuid;
BEGIN
  SELECT grant_id INTO v_grant
  FROM public.request_product_description_attestation_grant(
    '00000000-0000-4000-b200-000000000001',
    '00000000-0000-4000-c200-000000000001',
    '00000000-0000-4000-d200-000000000001',
    'C1 binding old bytes', 'default', repeat('0', 64), repeat('a', 64), true,
    'manual_description'
  );
  IF v_grant IS NULL THEN RAISE EXCEPTION 'baseline binding grant was not issued'; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TEMP TABLE c1_binding_cases (
  case_name text,
  actor_id uuid,
  merchant_id uuid,
  product_id uuid,
  expected_description text,
  expected_source_type text,
  expected_sha256 text,
  proposed_sha256 text,
  full_replacement boolean,
  purpose text
) ON COMMIT DROP;

INSERT INTO c1_binding_cases VALUES
  ('actor', '00000000-0000-4000-a200-000000000002', '00000000-0000-4000-b200-000000000001', '00000000-0000-4000-c200-000000000001', 'C1 binding old bytes', 'default', repeat('0', 64), repeat('a', 64), true, 'manual_description'),
  ('merchant', '00000000-0000-4000-a200-000000000001', '00000000-0000-4000-b200-000000000002', '00000000-0000-4000-c200-000000000001', 'C1 binding old bytes', 'default', repeat('0', 64), repeat('a', 64), true, 'manual_description'),
  ('product', '00000000-0000-4000-a200-000000000001', '00000000-0000-4000-b200-000000000001', '00000000-0000-4000-c200-000000000002', 'C1 binding old bytes', 'default', repeat('0', 64), repeat('a', 64), true, 'manual_description'),
  ('old_description', '00000000-0000-4000-a200-000000000001', '00000000-0000-4000-b200-000000000001', '00000000-0000-4000-c200-000000000001', 'changed old bytes', 'default', repeat('0', 64), repeat('a', 64), true, 'manual_description'),
  ('old_source_type', '00000000-0000-4000-a200-000000000001', '00000000-0000-4000-b200-000000000001', '00000000-0000-4000-c200-000000000001', 'C1 binding old bytes', 'unknown', repeat('0', 64), repeat('a', 64), true, 'manual_description'),
  ('old_sha256', '00000000-0000-4000-a200-000000000001', '00000000-0000-4000-b200-000000000001', '00000000-0000-4000-c200-000000000001', 'C1 binding old bytes', 'default', repeat('1', 64), repeat('a', 64), true, 'manual_description'),
  ('proposed_sha256', '00000000-0000-4000-a200-000000000001', '00000000-0000-4000-b200-000000000001', '00000000-0000-4000-c200-000000000001', 'C1 binding old bytes', 'default', repeat('0', 64), repeat('b', 64), true, 'manual_description'),
  ('full_replacement', '00000000-0000-4000-a200-000000000001', '00000000-0000-4000-b200-000000000001', '00000000-0000-4000-c200-000000000001', 'C1 binding old bytes', 'default', repeat('0', 64), repeat('a', 64), false, 'manual_description'),
  ('purpose', '00000000-0000-4000-a200-000000000001', '00000000-0000-4000-b200-000000000001', '00000000-0000-4000-c200-000000000001', 'C1 binding old bytes', 'default', repeat('0', 64), repeat('a', 64), true, 'catalog_repair');

DO $$
DECLARE test_case c1_binding_cases%ROWTYPE;
BEGIN
  FOR test_case IN SELECT * FROM c1_binding_cases ORDER BY case_name LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', test_case.actor_id, 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM public.request_product_description_attestation_grant(
        test_case.merchant_id, test_case.product_id,
        '00000000-0000-4000-d200-000000000001',
        test_case.expected_description, test_case.expected_source_type,
        test_case.expected_sha256, test_case.proposed_sha256,
        test_case.full_replacement, test_case.purpose
      );
      RAISE EXCEPTION 'changed % binding replay was accepted', test_case.case_name;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'product_description_attestation_operation_binding_mismatch' THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a200-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE first_grant uuid; replay_grant uuid;
BEGIN
  SELECT grant_id INTO first_grant FROM public.request_product_description_attestation_grant(
    '00000000-0000-4000-b200-000000000001', '00000000-0000-4000-c200-000000000001',
    '00000000-0000-4000-d200-000000000002', 'C1 binding old bytes', 'default', repeat('0', 64), repeat('c', 64), false, 'manual_description'
  );
  SELECT grant_id INTO replay_grant FROM public.request_product_description_attestation_grant(
    '00000000-0000-4000-b200-000000000001', '00000000-0000-4000-c200-000000000001',
    '00000000-0000-4000-d200-000000000002', 'C1 binding old bytes', 'default', repeat('0', 64), repeat('c', 64), false, 'manual_description'
  );
  IF first_grant IS NULL OR replay_grant IS DISTINCT FROM first_grant THEN
    RAISE EXCEPTION 'full_replacement=false replay must return the original grant';
  END IF;
END;
$$ LANGUAGE plpgsql;

RESET ROLE;
UPDATE private.product_description_attestation_grants
SET consumed_at = pg_catalog.clock_timestamp()
WHERE operation_id = '00000000-0000-4000-d200-000000000002';

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a200-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.request_product_description_attestation_grant(
      '00000000-0000-4000-b200-000000000001', '00000000-0000-4000-c200-000000000001',
      '00000000-0000-4000-d200-000000000002', 'C1 binding old bytes', 'default', repeat('0', 64), repeat('c', 64), false, 'manual_description'
    );
    RAISE EXCEPTION 'consumed grant replay was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'product_description_attestation_grant_consumed' THEN RAISE; END IF;
  END;
END;
$$ LANGUAGE plpgsql;
RESET ROLE;

ROLLBACK;
