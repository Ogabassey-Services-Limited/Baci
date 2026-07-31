\set ON_ERROR_STOP on

-- Repair, staff-ownership, identity, and function-security regressions.
-- Fixtures are deterministic and rolled back.
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('9b2a0000-0000-4000-8000-000000000004', 'repair-owner@example.test'),
  ('9b2a0000-0000-4000-8000-000000000005', 'foreign-staff@example.test'),
  ('9b2a0000-0000-4000-8000-000000000006', 'staff-owner@example.test'),
  ('9b2a0000-0000-4000-8000-000000000009', 'identity-only@example.test'),
  ('9b2a0000-0000-4000-8000-000000000011', 'pending-owner@example.test');

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
  v_definition text;
  v_is_security_definer boolean;
BEGIN
  SELECT function_row.proargnames,
         pg_catalog.pg_get_functiondef(function_row.oid),
         function_row.prosecdef
    INTO v_args, v_definition, v_is_security_definer
    FROM pg_catalog.pg_proc AS function_row
   WHERE function_row.oid =
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
  IF v_is_security_definer IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'mobile provisioning must remain security invoker';
  END IF;
  IF (
    pg_catalog.length(v_definition)
    - pg_catalog.length(pg_catalog.replace(
      v_definition,
      'PERFORM pg_catalog.set_config(''app.merchant_sensitive_update_authorized'', ''true'', true);',
      ''
    ))
  ) / pg_catalog.length(
    'PERFORM pg_catalog.set_config(''app.merchant_sensitive_update_authorized'', ''true'', true);'
  ) <> 1 THEN
    RAISE EXCEPTION 'mobile provisioning must set one sensitive-update capability';
  END IF;
END
$test$;

ROLLBACK;
