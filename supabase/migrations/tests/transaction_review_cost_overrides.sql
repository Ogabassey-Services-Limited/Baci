-- =============================================
-- REGRESSION TEST: transaction review cost overrides
--   Validates transaction-specific order item cost/supplier storage and
--   atomic catalog-default updates.
--
-- USAGE:
--   psql $DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/migrations/tests/transaction_review_cost_overrides.sql
--
-- This script intentionally mutates inside a transaction and rolls back.
-- =============================================

BEGIN;

DO $$
DECLARE
  missing_column text;
BEGIN
  SELECT expected.column_name INTO missing_column
  FROM (
    VALUES
      ('order_items.cost_price'),
      ('order_items.supplier_name'),
      ('order_items.product_match_status')
  ) AS expected(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = split_part(expected.column_name, '.', 1)
      AND c.column_name = split_part(expected.column_name, '.', 2)
  )
  LIMIT 1;

  IF missing_column IS NOT NULL THEN
    RAISE EXCEPTION 'transaction review migration missing column %', missing_column;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_cost_price_non_negative'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    RAISE EXCEPTION 'order_items cost price non-negative constraint missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_product_match_status_check'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    RAISE EXCEPTION 'order_items product match status constraint missing';
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  v_merchant_id uuid := '00000000-0000-4000-8000-00000000f101';
  v_product_id uuid := '00000000-0000-4000-8000-00000000f201';
  v_variant_id uuid := '00000000-0000-4000-8000-00000000f202';
  v_order_id uuid := '00000000-0000-4000-8000-00000000f301';
  v_linked_item_id uuid := '00000000-0000-4000-8000-00000000f401';
  v_custom_item_id uuid := '00000000-0000-4000-8000-00000000f402';
  v_variant_item_id uuid := '00000000-0000-4000-8000-00000000f403';
  v_owner_user_id uuid := '00000000-0000-4000-8000-00000000f100';
  v_staff_user_id uuid := '00000000-0000-4000-8000-00000000f102';
  v_linked_cost numeric;
  v_custom_cost numeric;
  v_product_cost numeric;
  v_variant_cost numeric;
  v_variant_item_cost numeric;
BEGIN
  INSERT INTO public.merchants (
    id,
    email,
    business_name,
    slug
  ) VALUES (
    v_merchant_id,
    'transaction-review-test@example.com',
    'Transaction Review Test',
    'transaction-review-test'
  );

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
  ) VALUES
    (
      v_owner_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'transaction-review-owner@example.com',
      'test',
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{}'::jsonb
    ),
    (
      v_staff_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'transaction-review-staff@example.com',
      'test',
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{}'::jsonb
    );

  UPDATE public.merchants
  SET user_id = v_owner_user_id
  WHERE id = v_merchant_id;

  INSERT INTO public.staff_members (
    merchant_id,
    user_id,
    email,
    name,
    role,
    permissions,
    status
  ) VALUES (
    v_merchant_id,
    v_staff_user_id,
    'transaction-review-staff@example.com',
    'Transaction Review Staff',
    'sales_rep',
    '{"orders": {"edit": true}}'::jsonb,
    'active'
  );

  INSERT INTO public.products (
    id,
    merchant_id,
    name,
    price,
    status,
    cost_price
  ) VALUES (
    v_product_id,
    v_merchant_id,
    'iPhone 11 Pro',
    450000,
    'active',
    NULL
  );

  INSERT INTO public.product_variants (
    id,
    product_id,
    merchant_id,
    attributes,
    condition,
    price_override,
    cost_price
  ) VALUES (
    v_variant_id,
    v_product_id,
    v_merchant_id,
    '{"storage": "64GB", "condition_label": "Premium Used"}'::jsonb,
    'used',
    180000,
    NULL
  );

  INSERT INTO public.orders (
    id,
    merchant_id,
    order_number,
    customer_name,
    payment_status,
    payment_method,
    subtotal,
    total,
    source
  ) VALUES (
    v_order_id,
    v_merchant_id,
    'ORD-TRX-TEST',
    'Test Customer',
    'paid',
    'transfer',
    380000,
    380000,
    'physical'
  );

  INSERT INTO public.order_items (
    id,
    order_id,
    product_id,
    name,
    price,
    quantity,
    variant_id
  ) VALUES
    (
      v_linked_item_id,
      v_order_id,
      v_product_id,
      'iPhone 11 Pro',
      180000,
      1,
      NULL
    ),
    (
      v_custom_item_id,
      v_order_id,
      NULL,
      'Itel Buds Neo 3',
      20000,
      1,
      NULL
    ),
    (
      v_variant_item_id,
      v_order_id,
      v_product_id,
      'iPhone 11 Pro 64GB Premium Used',
      180000,
      1,
      v_variant_id
    );

  PERFORM public.update_transaction_review_details(
    v_merchant_id,
    v_order_id,
    v_linked_item_id,
    v_product_id,
    NULL,
    150000,
    'Slot Wholesale',
    now(),
    'Africa/Lagos',
    true
  );

  PERFORM public.update_transaction_review_details(
    v_merchant_id,
    v_order_id,
    v_custom_item_id,
    NULL,
    NULL,
    12000,
    'Accessories Vendor',
    now(),
    'Africa/Lagos',
    false
  );

  PERFORM public.update_transaction_review_details(
    v_merchant_id,
    v_order_id,
    v_variant_item_id,
    v_product_id,
    v_variant_id,
    130000,
    'Variant Supplier',
    now(),
    'Africa/Lagos',
    true
  );

  SELECT cost_price INTO v_linked_cost
  FROM public.order_items
  WHERE id = v_linked_item_id;

  SELECT cost_price INTO v_custom_cost
  FROM public.order_items
  WHERE id = v_custom_item_id;

  SELECT cost_price INTO v_product_cost
  FROM public.products
  WHERE id = v_product_id;

  SELECT cost_price INTO v_variant_item_cost
  FROM public.order_items
  WHERE id = v_variant_item_id;

  SELECT cost_price INTO v_variant_cost
  FROM public.product_variants
  WHERE id = v_variant_id;

  IF v_linked_cost <> 150000 THEN
    RAISE EXCEPTION 'linked item cost was not stored on order_items';
  END IF;

  IF v_custom_cost <> 12000 THEN
    RAISE EXCEPTION 'custom item cost was not stored on order_items';
  END IF;

  IF v_product_cost <> 150000 THEN
    RAISE EXCEPTION 'linked product default was not updated when requested';
  END IF;

  IF v_variant_item_cost <> 130000 THEN
    RAISE EXCEPTION 'variant item cost was not stored on order_items';
  END IF;

  IF v_variant_cost <> 130000 THEN
    RAISE EXCEPTION 'variant default was not updated when requested';
  END IF;

  BEGIN
    PERFORM public.update_transaction_review_details(
      v_merchant_id,
      v_order_id,
      v_custom_item_id,
      NULL,
      NULL,
      12000,
      'Accessories Vendor',
      now() + interval '1 day',
      'Africa/Lagos',
      false
    );

    RAISE EXCEPTION 'future transaction date was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000f100', true);

SELECT public.update_transaction_review_details(
  '00000000-0000-4000-8000-00000000f101'::uuid,
  '00000000-0000-4000-8000-00000000f301'::uuid,
  '00000000-0000-4000-8000-00000000f401'::uuid,
  '00000000-0000-4000-8000-00000000f201'::uuid,
  NULL,
  151000,
  'Slot Wholesale',
  now(),
  'Africa/Lagos',
  true
);

SELECT public.update_transaction_review_details(
  '00000000-0000-4000-8000-00000000f101'::uuid,
  '00000000-0000-4000-8000-00000000f301'::uuid,
  '00000000-0000-4000-8000-00000000f403'::uuid,
  '00000000-0000-4000-8000-00000000f201'::uuid,
  '00000000-0000-4000-8000-00000000f202'::uuid,
  131000,
  'Variant Supplier',
  now(),
  'Africa/Lagos',
  true
);

SELECT public.update_transaction_review_details(
  '00000000-0000-4000-8000-00000000f101'::uuid,
  '00000000-0000-4000-8000-00000000f301'::uuid,
  '00000000-0000-4000-8000-00000000f402'::uuid,
  NULL,
  NULL,
  12100,
  'Accessories Vendor',
  now(),
  'Africa/Lagos',
  false
);

RESET ROLE;

DO $$
DECLARE
  v_owner_custom_cost numeric;
  v_owner_linked_cost numeric;
  v_owner_product_cost numeric;
  v_owner_variant_cost numeric;
  v_owner_variant_item_cost numeric;
BEGIN
  SELECT cost_price INTO v_owner_linked_cost
  FROM public.order_items
  WHERE id = '00000000-0000-4000-8000-00000000f401';

  SELECT cost_price INTO v_owner_custom_cost
  FROM public.order_items
  WHERE id = '00000000-0000-4000-8000-00000000f402';

  SELECT cost_price INTO v_owner_product_cost
  FROM public.products
  WHERE id = '00000000-0000-4000-8000-00000000f201';

  SELECT cost_price INTO v_owner_variant_item_cost
  FROM public.order_items
  WHERE id = '00000000-0000-4000-8000-00000000f403';

  SELECT cost_price INTO v_owner_variant_cost
  FROM public.product_variants
  WHERE id = '00000000-0000-4000-8000-00000000f202';

  IF v_owner_linked_cost <> 151000 OR v_owner_product_cost <> 151000 THEN
    RAISE EXCEPTION 'authenticated merchant owner could not update linked item and product default';
  END IF;

  IF v_owner_variant_item_cost <> 131000 OR v_owner_variant_cost <> 131000 THEN
    RAISE EXCEPTION 'authenticated merchant owner could not update variant item and variant default';
  END IF;

  IF v_owner_custom_cost <> 12100 THEN
    RAISE EXCEPTION 'authenticated merchant owner could not update custom item cost';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000f102', true);

SELECT public.update_transaction_review_details(
  '00000000-0000-4000-8000-00000000f101'::uuid,
  '00000000-0000-4000-8000-00000000f301'::uuid,
  '00000000-0000-4000-8000-00000000f402'::uuid,
  NULL,
  NULL,
  11000,
  'Accessories Vendor',
  now(),
  'Africa/Lagos',
  false
);

DO $$
BEGIN
  PERFORM public.update_transaction_review_details(
    '00000000-0000-4000-8000-00000000f101'::uuid,
    '00000000-0000-4000-8000-00000000f301'::uuid,
    '00000000-0000-4000-8000-00000000f401'::uuid,
    '00000000-0000-4000-8000-00000000f201'::uuid,
    NULL,
    140000,
    'Slot Wholesale',
    now(),
    'Africa/Lagos',
    true
  );

  RAISE EXCEPTION 'orders-edit staff updated a product default without products.edit';
EXCEPTION WHEN SQLSTATE 'P0001' THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM public.update_transaction_review_details(
    '00000000-0000-4000-8000-00000000f101'::uuid,
    '00000000-0000-4000-8000-00000000f301'::uuid,
    '00000000-0000-4000-8000-00000000f403'::uuid,
    '00000000-0000-4000-8000-00000000f201'::uuid,
    '00000000-0000-4000-8000-00000000f202'::uuid,
    125000,
    'Variant Supplier',
    now(),
    'Africa/Lagos',
    true
  );

  RAISE EXCEPTION 'orders-edit staff updated a variant default without products.edit';
EXCEPTION WHEN SQLSTATE 'P0001' THEN
  NULL;
END $$;

RESET ROLE;

DO $$
DECLARE
  v_product_cost numeric;
  v_staff_cost numeric;
  v_staff_linked_cost numeric;
  v_staff_variant_item_cost numeric;
  v_variant_cost numeric;
BEGIN
  SELECT cost_price INTO v_staff_cost
  FROM public.order_items
  WHERE id = '00000000-0000-4000-8000-00000000f402';

  IF v_staff_cost <> 11000 THEN
    RAISE EXCEPTION 'orders-edit staff could not update order item cost through RLS';
  END IF;

  SELECT cost_price INTO v_staff_linked_cost
  FROM public.order_items
  WHERE id = '00000000-0000-4000-8000-00000000f401';

  SELECT cost_price INTO v_product_cost
  FROM public.products
  WHERE id = '00000000-0000-4000-8000-00000000f201';

  SELECT cost_price INTO v_staff_variant_item_cost
  FROM public.order_items
  WHERE id = '00000000-0000-4000-8000-00000000f403';

  SELECT cost_price INTO v_variant_cost
  FROM public.product_variants
  WHERE id = '00000000-0000-4000-8000-00000000f202';

  IF v_staff_linked_cost <> 151000 OR v_product_cost <> 151000 THEN
    RAISE EXCEPTION 'failed product-default update leaked partial changes';
  END IF;

  IF v_staff_variant_item_cost <> 131000 OR v_variant_cost <> 131000 THEN
    RAISE EXCEPTION 'failed variant-default update leaked partial changes';
  END IF;
END $$;

ROLLBACK;
