-- REGRESSION TEST: order viewers can refresh an existing Paystack invoice
-- account balance, while staff without order access remain forbidden.
--
-- USAGE:
--   supabase test db supabase/tests/paystack_order_dva_balance_refresh_permissions.sql

BEGIN;

SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

DO $fixtures$
DECLARE
  v_owner_id uuid := '3d7a0001-0000-4000-8000-000000000001';
  v_viewer_id uuid := '3d7a0001-0000-4000-8000-000000000002';
  v_denied_id uuid := '3d7a0001-0000-4000-8000-000000000003';
  v_merchant_id uuid := '3d7a0100-0000-4000-8000-000000000001';
  v_order_id uuid := '3d7a0200-0000-4000-8000-000000000001';
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES
    (v_owner_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'dva-owner@example.test', 'test',
      pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{}'::jsonb,
      '{}'::jsonb),
    (v_viewer_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'dva-viewer@example.test', 'test',
      pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{}'::jsonb,
      '{}'::jsonb),
    (v_denied_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'dva-denied@example.test', 'test',
      pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), '{}'::jsonb,
      '{}'::jsonb);

  INSERT INTO public.merchants (
    id, user_id, email, business_name, slug
  ) VALUES (
    v_merchant_id, v_owner_id, 'dva-owner@example.test',
    'DVA Permission Fixture', 'dva-permission-fixture'
  );

  INSERT INTO public.staff_members (
    merchant_id, user_id, email, name, role, permissions, status
  ) VALUES
    (v_merchant_id, v_viewer_id, 'dva-viewer@example.test',
      'DVA Viewer', 'accountant',
      '{"orders":{"view":true,"edit":false}}'::jsonb, 'active'),
    (v_merchant_id, v_denied_id, 'dva-denied@example.test',
      'DVA Denied', 'accountant',
      '{"orders":{"view":false,"edit":false}}'::jsonb, 'active');

  INSERT INTO public.orders (
    id, merchant_id, order_number, total, amount_paid, wallet_amount_used,
    payment_status, shipping_status
  ) VALUES (
    v_order_id, v_merchant_id, 'DVA-PERMISSION-001', 5000, 1000, 500,
    'unpaid', 'pending'
  );

  INSERT INTO public.order_payment_accounts (
    order_id, account_number, bank_name, account_name, provider,
    payable_amount, assigned_at, expires_at
  ) VALUES (
    v_order_id, '9876543210', 'Wema Bank', 'DVA Permission Fixture',
    'paystack', 0, pg_catalog.now(),
    pg_catalog.now() + pg_catalog.make_interval(mins => 90)
  );
END;
$fixtures$;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '3d7a0001-0000-4000-8000-000000000002',
  true
);

DO $view_only_staff$
DECLARE
  v_payable_amount numeric;
  v_stored_amount numeric;
BEGIN
  SELECT public.refresh_paystack_order_payable_amount(
    '3d7a0200-0000-4000-8000-000000000001'
  ) INTO v_payable_amount;

  IF v_payable_amount IS DISTINCT FROM 4000::numeric THEN
    RAISE EXCEPTION
      'view-only staff expected payable amount 4000, got %',
      v_payable_amount;
  END IF;

  SELECT payable_amount INTO v_stored_amount
  FROM public.order_payment_accounts
  WHERE order_id = '3d7a0200-0000-4000-8000-000000000001'
    AND provider = 'paystack';

  IF v_stored_amount IS DISTINCT FROM 4000::numeric THEN
    RAISE EXCEPTION
      'view-only refresh expected stored payable amount 4000, got %',
      v_stored_amount;
  END IF;
END;
$view_only_staff$;

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '3d7a0001-0000-4000-8000-000000000003',
  true
);

DO $denied_staff$
DECLARE
  v_forbidden boolean := false;
BEGIN
  BEGIN
    PERFORM public.refresh_paystack_order_payable_amount(
      '3d7a0200-0000-4000-8000-000000000001'
    );
  EXCEPTION WHEN raise_exception THEN
    v_forbidden := SQLERRM = 'forbidden';
  END;

  IF NOT v_forbidden THEN
    RAISE EXCEPTION
      'staff without orders.view or orders.edit was not rejected with forbidden';
  END IF;
END;
$denied_staff$;

ROLLBACK;
