-- =============================================
-- REGRESSION TEST: transaction reconciliation link RPC
--   Validates merchant-scoped product/variant linking for historical
--   unlinked paid order items.
--
-- USAGE:
--   psql $DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/migrations/tests/transaction_reconciliation_link.sql
--
-- This script intentionally mutates inside a transaction and rolls back.
-- =============================================

BEGIN;

DO $$
DECLARE
  v_merchant_id uuid := '00000000-0000-4000-8000-00000000e101';
  v_other_merchant_id uuid := '00000000-0000-4000-8000-00000000e102';
  v_product_id uuid := '00000000-0000-4000-8000-00000000e201';
  v_other_product_id uuid := '00000000-0000-4000-8000-00000000e202';
  v_variant_id uuid := '00000000-0000-4000-8000-00000000e301';
  v_order_id uuid := '00000000-0000-4000-8000-00000000e401';
  v_item_id uuid := '00000000-0000-4000-8000-00000000e501';
  v_custom_item_id uuid := '00000000-0000-4000-8000-00000000e502';
  v_cross_item_id uuid := '00000000-0000-4000-8000-00000000e503';
  v_mark_custom_item_id uuid := '00000000-0000-4000-8000-00000000e504';
  v_owner_user_id uuid := '00000000-0000-4000-8000-00000000e100';
BEGIN
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  ) VALUES (
    v_owner_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'reconcile-owner@example.com',
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES
    (
      v_merchant_id,
      v_owner_user_id,
      'reconcile-test@example.com',
      'Reconcile Test',
      'reconcile-test'
    ),
    (
      v_other_merchant_id,
      NULL,
      'reconcile-other@example.com',
      'Reconcile Other',
      'reconcile-other'
    );

  INSERT INTO public.products (id, merchant_id, name, price, status)
  VALUES
    (v_product_id, v_merchant_id, 'iPhone 11 Pro', 450000, 'active'),
    (v_other_product_id, v_other_merchant_id, 'Other Product', 1000, 'active');

  INSERT INTO public.product_variants (
    id,
    product_id,
    merchant_id,
    attributes,
    price_override
  ) VALUES (
    v_variant_id,
    v_product_id,
    v_merchant_id,
    '{"storage": "64GB", "condition_label": "Premium Used"}'::jsonb,
    180000
  );

  INSERT INTO public.orders (
    id,
    merchant_id,
    order_number,
    customer_name,
    payment_status,
    subtotal,
    total,
    source
  ) VALUES (
    v_order_id,
    v_merchant_id,
    'ORD-RECON-TEST',
    'Reconcile Customer',
    'paid',
    200000,
    200000,
    'physical'
  );

  INSERT INTO public.order_items (
    id,
    order_id,
    product_id,
    name,
    price,
    quantity,
    product_match_status
  ) VALUES
    (
      v_item_id,
      v_order_id,
      NULL,
      'iPhone 11 Pro 64gb Premium Used',
      180000,
      1,
      'unreviewed'
    ),
    (
      v_custom_item_id,
      v_order_id,
      NULL,
      'Itel Buds Neo 3',
      20000,
      1,
      'custom'
    ),
    (
      v_cross_item_id,
      v_order_id,
      NULL,
      'Other merchant product candidate',
      1000,
      1,
      'unreviewed'
    ),
    (
      v_mark_custom_item_id,
      v_order_id,
      NULL,
      'Standalone custom charger',
      25000,
      1,
      'unreviewed'
    );
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e100', true);

SELECT public.link_transaction_order_item_product(
  '00000000-0000-4000-8000-00000000e101'::uuid,
  '00000000-0000-4000-8000-00000000e501'::uuid,
  '00000000-0000-4000-8000-00000000e201'::uuid,
  '00000000-0000-4000-8000-00000000e301'::uuid
);

SELECT public.mark_transaction_order_item_custom(
  '00000000-0000-4000-8000-00000000e101'::uuid,
  '00000000-0000-4000-8000-00000000e504'::uuid
);

DO $$
BEGIN
  BEGIN
    PERFORM public.link_transaction_order_item_product(
      '00000000-0000-4000-8000-00000000e101'::uuid,
      '00000000-0000-4000-8000-00000000e502'::uuid,
      '00000000-0000-4000-8000-00000000e201'::uuid,
      NULL
    );
    RAISE EXCEPTION 'custom row was linked after keep-custom';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    NULL;
  END;

  BEGIN
    PERFORM public.link_transaction_order_item_product(
      '00000000-0000-4000-8000-00000000e101'::uuid,
      '00000000-0000-4000-8000-00000000e503'::uuid,
      '00000000-0000-4000-8000-00000000e202'::uuid,
      NULL
    );
    RAISE EXCEPTION 'cross-merchant product was linked';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    NULL;
  END;
END $$;

RESET ROLE;

DO $$
DECLARE
  v_cross_product_id uuid;
  v_marked_status text;
  v_saved_product_id uuid;
  v_saved_variant_id uuid;
BEGIN
  SELECT product_id, variant_id
  INTO v_saved_product_id, v_saved_variant_id
  FROM public.order_items
  WHERE id = '00000000-0000-4000-8000-00000000e501';

  IF v_saved_product_id <> '00000000-0000-4000-8000-00000000e201'::uuid
     OR v_saved_variant_id <> '00000000-0000-4000-8000-00000000e301'::uuid THEN
    RAISE EXCEPTION 'variant reconciliation did not store parent product_id and variant_id';
  END IF;

  SELECT product_id INTO v_cross_product_id
  FROM public.order_items
  WHERE id = '00000000-0000-4000-8000-00000000e503';

  IF v_cross_product_id IS NOT NULL THEN
    RAISE EXCEPTION 'cross-merchant product failure leaked a product_id update';
  END IF;

  SELECT product_match_status INTO v_marked_status
  FROM public.order_items
  WHERE id = '00000000-0000-4000-8000-00000000e504';

  IF v_marked_status <> 'custom' THEN
    RAISE EXCEPTION 'merchant-scoped custom marker did not update the item';
  END IF;
END $$;

ROLLBACK;
