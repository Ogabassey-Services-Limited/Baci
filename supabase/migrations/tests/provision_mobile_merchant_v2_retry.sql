\set ON_ERROR_STOP on

-- Idempotent retry and phone-update regression coverage for mobile provisioning.
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('9b2a0000-0000-4000-8000-000000000001', 'mobile-owner@example.test');

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
  v_phone text;
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
  SELECT phone INTO v_phone
    FROM public.merchants
   WHERE id = v_first.merchant_id;
  IF v_phone IS DISTINCT FROM '+2348099999999' THEN
    RAISE EXCEPTION 'authenticated provisioning retry did not update phone: %',
      v_phone;
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

ROLLBACK;
