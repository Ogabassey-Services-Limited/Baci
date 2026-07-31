\set ON_ERROR_STOP on

-- Guarded regression suite for provision_mobile_merchant_v2.
-- All fixtures are deterministic and rolled back.
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('9b2a0000-0000-4000-8000-000000000001', 'mobile-owner@example.test'),
  ('9b2a0000-0000-4000-8000-000000000002', 'collision-owner@example.test'),
  ('9b2a0000-0000-4000-8000-000000000003', 'country-owner@example.test'),
  ('9b2a0000-0000-4000-8000-000000000004', 'repair-owner@example.test'),
  ('9b2a0000-0000-4000-8000-000000000005', 'foreign-staff@example.test'),
  ('9b2a0000-0000-4000-8000-000000000006', 'staff-owner@example.test'),
  ('9b2a0000-0000-4000-8000-000000000007', 'rollback-owner@example.test'),
  ('9b2a0000-0000-4000-8000-000000000008', 'automatic-owner@example.test'),
  ('9b2a0000-0000-4000-8000-000000000009', 'identity-only@example.test'),
  ('9b2a0000-0000-4000-8000-000000000010', 'collision-tester@example.test'),
  ('9b2a0000-0000-4000-8000-000000000011', 'pending-owner@example.test');

-- These seed rows are database-side setup, not authenticated product writes.
-- Clear any inherited test JWT and use a bounded owner actor only while they
-- are inserted, then clear it before each authenticated RPC assertion.
SELECT pg_catalog.set_config('request.jwt.claim.role', '', true);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{}'::jsonb::text, true);
SELECT pg_catalog.set_config(
  'app.audit_actor_user_id',
  '9b2a0000-0000-4000-8000-000000000002',
  true
);
INSERT INTO public.merchants (
  id, user_id, email, business_name, business_type, country,
  payout_currency, slug, signup_source
) VALUES (
  '9b2a1000-0000-4000-8000-000000000002',
  '9b2a0000-0000-4000-8000-000000000002',
  'collision-owner@example.test', 'Collision Owner', 'retail',
  'NG', 'NGN', 'live-mobile-slug', 'web'
);
INSERT INTO public.merchant_slug_aliases (old_slug, merchant_id)
VALUES (
  'retired-mobile-slug',
  '9b2a1000-0000-4000-8000-000000000002'
);
INSERT INTO public.domains (
  merchant_id, domain, tld, domain_type, status, is_primary
) VALUES (
  '9b2a1000-0000-4000-8000-000000000002',
  'domain-mobile-clash.usebaci.com', '.usebaci.com',
  'subdomain', 'active', true
);
SELECT pg_catalog.set_config('app.audit_actor_user_id', '', true);
\ir provision_mobile_merchant_v2/000_seed_audit_attribution.sql

SELECT set_config(
  'request.jwt.claim.sub',
  '9b2a0000-0000-4000-8000-000000000001',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"9b2a0000-0000-4000-8000-000000000001","email":"mobile-owner@example.test","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

DO $test$
DECLARE
  v_first record;
  v_retry record;
  v_count integer;
BEGIN
  SELECT * INTO v_first
  FROM public.provision_mobile_merchant_v2(
    'Mobile', 'Owner', '+2348012345678', 'Mobile Owner Store',
    'retail', NULL, 'NG', 'mobile-owner-store', true, NULL,
    '{"primary":"#111111","background":"#ffffff","accent":"#ff5500"}',
    'ios'
  );
  IF NOT v_first.created OR v_first.merchant_slug <> 'mobile-owner-store' THEN
    RAISE EXCEPTION 'first provisioning result was incorrect';
  END IF;

  SELECT * INTO v_retry
  FROM public.provision_mobile_merchant_v2(
    'Updated', 'Owner', '+2348099999999', 'Updated Owner Store',
    'services', NULL, 'GH', 'must-not-rename', true, NULL, NULL, 'android'
  );
  IF v_retry.created OR v_retry.merchant_id <> v_first.merchant_id
     OR v_retry.merchant_slug <> 'mobile-owner-store' THEN
    RAISE EXCEPTION 'retry did not converge or preserved slug was renamed';
  END IF;

  SELECT count(*) INTO v_count FROM public.merchants
  WHERE user_id = '9b2a0000-0000-4000-8000-000000000001';
  IF v_count <> 1 THEN RAISE EXCEPTION 'merchant cardinality drifted'; END IF;
  SELECT count(*) INTO v_count FROM public.domains
  WHERE merchant_id = v_first.merchant_id
    AND domain = 'mobile-owner-store.usebaci.com'
    AND status = 'active' AND is_primary;
  IF v_count <> 1 THEN RAISE EXCEPTION 'platform domain was not provisioned'; END IF;
  SELECT count(*) INTO v_count FROM public.staff_members
  WHERE merchant_id = v_first.merchant_id
    AND user_id = '9b2a0000-0000-4000-8000-000000000001'
    AND email = 'mobile-owner@example.test'
    AND role = 'admin' AND status = 'active';
  IF v_count <> 1 THEN RAISE EXCEPTION 'owner staff was not provisioned'; END IF;
END
$test$;

-- Explicit collisions and format failures are stable and leave no owner row.
RESET ROLE;
SELECT set_config(
  'request.jwt.claim.sub',
  '9b2a0000-0000-4000-8000-000000000010',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"9b2a0000-0000-4000-8000-000000000010","email":"collision-tester@example.test","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE
  v_case text;
  v_slug text;
  v_state text;
BEGIN
  FOREACH v_case IN ARRAY ARRAY[
    'live', 'retired', 'reserved', 'domain', 'invalid', 'too-long'
  ] LOOP
    v_slug := CASE v_case
      WHEN 'live' THEN 'live-mobile-slug'
      WHEN 'retired' THEN 'retired-mobile-slug'
      WHEN 'reserved' THEN 'admin'
      WHEN 'domain' THEN 'domain-mobile-clash'
      WHEN 'invalid' THEN 'Bad Slug'
      ELSE repeat('a', 64)
    END;
    BEGIN
      PERFORM public.provision_mobile_merchant_v2(
        'Collision', 'Tester', NULL, 'Collision Test', 'retail', NULL,
        'NG', v_slug, true, NULL, NULL, 'ios'
      );
      RAISE EXCEPTION 'explicit % slug was accepted', v_case;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
      IF v_case IN ('invalid', 'too-long') AND v_state <> 'PT400' THEN
        RAISE EXCEPTION '% mapped to %, expected PT400', v_case, v_state;
      ELSIF v_case NOT IN ('invalid', 'too-long') AND v_state <> 'PT409' THEN
        RAISE EXCEPTION '% mapped to %, expected PT409', v_case, v_state;
      END IF;
    END;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM public.merchants
    WHERE user_id = '9b2a0000-0000-4000-8000-000000000010'
  ) THEN
    RAISE EXCEPTION 'failed explicit collision leaked a merchant row';
  END IF;
END
$test$;

-- Invalid telemetry source writes nothing; an automatic live collision advances.
RESET ROLE;
SELECT set_config(
  'request.jwt.claim.sub',
  '9b2a0000-0000-4000-8000-000000000008',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"9b2a0000-0000-4000-8000-000000000008","email":"automatic-owner@example.test","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE
  v_result record;
BEGIN
  BEGIN
    PERFORM public.provision_mobile_merchant_v2(
      'Automatic', 'Owner', NULL, 'Live Mobile Slug', 'retail', NULL,
      'NG', NULL, false, NULL, NULL, 'web'
    );
    RAISE EXCEPTION 'invalid signup source was accepted';
  EXCEPTION WHEN sqlstate 'PT400' THEN NULL;
  END;
  SELECT * INTO v_result
  FROM public.provision_mobile_merchant_v2(
    'Automatic', 'Owner', NULL, 'Live Mobile Slug', 'retail', NULL,
    'NG', NULL, false, NULL, NULL, 'ios'
  );
  IF v_result.merchant_slug = 'live-mobile-slug'
     OR v_result.merchant_slug !~ '^live-mobile-slug-[0-9]+$' THEN
    RAISE EXCEPTION 'automatic collision did not advance: %',
      v_result.merchant_slug;
  END IF;
END
$test$;

RESET ROLE;
SELECT set_config(
  'request.jwt.claim.sub',
  '9b2a0000-0000-4000-8000-000000000003',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"9b2a0000-0000-4000-8000-000000000003","email":"country-owner@example.test","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

DO $test$
DECLARE
  v_pair record;
  v_result record;
  v_actual text;
BEGIN
  FOR v_pair IN
    SELECT * FROM (VALUES
      ('US','USD'), ('NG','NGN'), ('GB','GBP'), ('CA','CAD'),
      ('AU','AUD'), ('DE','EUR'), ('FR','EUR'), ('JP','JPY'),
      ('IN','INR'), ('BR','BRL'), ('ZA','ZAR'), ('AE','AED'),
      ('KE','KES'), ('GH','GHS'), ('EG','EGP'), ('CM','XAF'),
      ('CI','XOF'), ('SN','XOF'), ('BF','XOF'), ('RW','RWF'),
      ('TZ','TZS'), ('UG','UGX')
    ) AS pairs(country, currency)
  LOOP
    SELECT * INTO v_result
    FROM public.provision_mobile_merchant_v2(
      'Country', 'Tester', NULL, 'Country Test Store', 'retail', NULL,
      v_pair.country, NULL, false, NULL, NULL, 'android'
    );
    SELECT payout_currency INTO v_actual FROM public.merchants
    WHERE id = v_result.merchant_id;
    IF v_actual <> v_pair.currency THEN
      RAISE EXCEPTION 'country % persisted %, expected %',
        v_pair.country, v_actual, v_pair.currency;
    END IF;
  END LOOP;
  BEGIN
    PERFORM public.provision_mobile_merchant_v2(
      'Country', 'Tester', NULL, 'Country Test Store', 'retail', NULL,
      'ZZ', NULL, false, NULL, NULL, 'ios'
    );
    RAISE EXCEPTION 'unsupported country was accepted';
  EXCEPTION WHEN sqlstate 'PT400' THEN NULL;
  END;
END
$test$;

RESET ROLE;
SELECT pg_catalog.set_config('request.jwt.claim.role', '', true);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{}'::jsonb::text, true);
SELECT pg_catalog.set_config(
  'app.audit_actor_user_id',
  '9b2a0000-0000-4000-8000-000000000004',
  true
);
INSERT INTO public.merchants (
  id, user_id, email, business_name, business_type, country,
  payout_currency, slug, signup_source
) VALUES (
  '9b2a1000-0000-4000-8000-000000000004',
  '9b2a0000-0000-4000-8000-000000000004',
  'repair-owner@example.test', 'Repair Store', 'retail',
  'NG', 'NGN', 'repair-mobile-store', 'web'
);
INSERT INTO public.domains (
  merchant_id, domain, tld, domain_type, status, is_primary
) VALUES (
  '9b2a1000-0000-4000-8000-000000000004',
  'repair-store.example', '.example', 'custom', 'active', true
);
SELECT pg_catalog.set_config('app.audit_actor_user_id', '', true);
SELECT set_config(
  'request.jwt.claim.sub',
  '9b2a0000-0000-4000-8000-000000000004',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"9b2a0000-0000-4000-8000-000000000004","email":"repair-owner@example.test","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT * FROM public.provision_mobile_merchant_v2(
  'Repair', 'Owner', NULL, 'Repair Store', 'retail', NULL,
  'NG', 'ignored-retry-slug', true, NULL, NULL, 'ios'
);
DO $test$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.domains
    WHERE merchant_id = '9b2a1000-0000-4000-8000-000000000004'
      AND domain = 'repair-store.example' AND is_primary
  ) OR NOT EXISTS (
    SELECT 1 FROM public.domains
    WHERE merchant_id = '9b2a1000-0000-4000-8000-000000000004'
      AND domain = 'repair-mobile-store.usebaci.com' AND NOT is_primary
  ) THEN
    RAISE EXCEPTION 'custom primary was not preserved during platform repair';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE merchant_id = '9b2a1000-0000-4000-8000-000000000004'
      AND user_id = '9b2a0000-0000-4000-8000-000000000004'
      AND role = 'admin' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'missing owner staff was not repaired';
  END IF;
END
$test$;

-- A foreign owner-staff identity fails closed and rolls profile changes back.
RESET ROLE;
SELECT pg_catalog.set_config('request.jwt.claim.role', '', true);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{}'::jsonb::text, true);
SELECT pg_catalog.set_config(
  'app.audit_actor_user_id',
  '9b2a0000-0000-4000-8000-000000000006',
  true
);
INSERT INTO public.merchants (
  id, user_id, email, business_name, business_type, country,
  payout_currency, slug, signup_source
) VALUES (
  '9b2a1000-0000-4000-8000-000000000006',
  '9b2a0000-0000-4000-8000-000000000006',
  'staff-owner@example.test', 'Staff Conflict Original', 'retail',
  'NG', 'NGN', 'staff-conflict-store', 'web'
);
INSERT INTO public.staff_members (
  user_id, merchant_id, email, name, role, status
) VALUES (
  '9b2a0000-0000-4000-8000-000000000005',
  '9b2a1000-0000-4000-8000-000000000006',
  'staff-owner@example.test', 'Foreign Identity', 'manager', 'active'
);
SELECT pg_catalog.set_config('app.audit_actor_user_id', '', true);
SELECT set_config(
  'request.jwt.claim.sub',
  '9b2a0000-0000-4000-8000-000000000006',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"9b2a0000-0000-4000-8000-000000000006","email":"staff-owner@example.test","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
DO $test$
BEGIN
  BEGIN
    PERFORM public.provision_mobile_merchant_v2(
      'Staff', 'Owner', NULL, 'Must Roll Back', 'retail', NULL,
      'NG', NULL, false, NULL, NULL, 'ios'
    );
    RAISE EXCEPTION 'foreign staff identity was overwritten';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  IF EXISTS (
    SELECT 1 FROM public.merchants
    WHERE id = '9b2a1000-0000-4000-8000-000000000006'
      AND business_name = 'Must Roll Back'
  ) THEN
    RAISE EXCEPTION 'staff failure did not roll merchant update back';
  END IF;
END
$test$;

-- An unowned pending same-email staff row is claimed, cleared, and activated.
RESET ROLE;
SELECT pg_catalog.set_config('request.jwt.claim.role', '', true);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{}'::jsonb::text, true);
SELECT pg_catalog.set_config(
  'app.audit_actor_user_id',
  '9b2a0000-0000-4000-8000-000000000011',
  true
);
INSERT INTO public.merchants (
  id, user_id, email, business_name, business_type, country,
  payout_currency, slug, signup_source
) VALUES (
  '9b2a1000-0000-4000-8000-000000000011',
  '9b2a0000-0000-4000-8000-000000000011',
  'pending-owner@example.test', 'Pending Staff Store', 'retail',
  'NG', 'NGN', 'pending-staff-store', 'web'
);
INSERT INTO public.staff_members (
  merchant_id, email, name, role, status, invitation_token,
  invitation_expires_at
) VALUES (
  '9b2a1000-0000-4000-8000-000000000011',
  'pending-owner@example.test', 'Pending Owner', 'manager', 'pending',
  'mobile-pending-owner-token', pg_catalog.now() + interval '1 day'
);
SELECT pg_catalog.set_config('app.audit_actor_user_id', '', true);
SELECT set_config(
  'request.jwt.claim.sub',
  '9b2a0000-0000-4000-8000-000000000011',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"9b2a0000-0000-4000-8000-000000000011","email":"pending-owner@example.test","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT * FROM public.provision_mobile_merchant_v2(
  'Pending', 'Owner', NULL, 'Pending Staff Store', 'retail', NULL,
  'NG', NULL, false, NULL, NULL, 'android'
);
DO $test$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE merchant_id = '9b2a1000-0000-4000-8000-000000000011'
      AND user_id = '9b2a0000-0000-4000-8000-000000000011'
      AND role = 'admin' AND status = 'active'
      AND invitation_token IS NULL
      AND invitation_expires_at IS NULL
      AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'pending owner staff row was not safely claimed';
  END IF;
END
$test$;

-- Missing JWT email fails before writes; anonymous execution remains denied.
RESET ROLE;
SELECT set_config(
  'request.jwt.claim.sub',
  '9b2a0000-0000-4000-8000-000000000009',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"9b2a0000-0000-4000-8000-000000000009","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
DO $test$
BEGIN
  BEGIN
    PERFORM public.provision_mobile_merchant_v2(
      'No', 'Email', NULL, 'No Email Store', 'retail', NULL,
      'NG', NULL, false, NULL, NULL, 'ios'
    );
    RAISE EXCEPTION 'missing JWT email was accepted';
  EXCEPTION WHEN sqlstate 'PT422' THEN NULL;
  END;
  IF EXISTS (
    SELECT 1 FROM public.merchants
    WHERE user_id = '9b2a0000-0000-4000-8000-000000000009'
  ) THEN
    RAISE EXCEPTION 'identity failure wrote a merchant';
  END IF;
END
$test$;

RESET ROLE;
DO $test$
DECLARE
  v_args text[];
BEGIN
  SELECT proargnames INTO v_args FROM pg_catalog.pg_proc
  WHERE oid =
    'public.provision_mobile_merchant_v2(text,text,text,text,text,text,text,text,boolean,text,jsonb,text)'::regprocedure;
  IF v_args && ARRAY[
    'p_user_id', 'p_email', 'p_merchant_id', 'p_root_domain',
    'p_domain', 'p_role', 'p_is_published', 'p_payout_currency'
  ] THEN
    RAISE EXCEPTION 'RPC exposes an authority-selecting parameter';
  END IF;
  IF has_function_privilege(
    'anon',
    'public.provision_mobile_merchant_v2(text,text,text,text,text,text,text,text,boolean,text,jsonb,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon can execute mobile provisioning';
  END IF;
END
$test$;

ROLLBACK;
