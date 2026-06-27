-- =============================================
-- REGRESSION TEST: mobile admin order edit audit
--
-- USAGE:
--   psql $DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/migrations/tests/admin_order_edit_audit.sql
--
-- This script intentionally mutates inside a transaction and rolls back.
-- =============================================

BEGIN;

DO $$
DECLARE
  missing_object text;
BEGIN
  SELECT expected.name INTO missing_object
  FROM (
    VALUES
      ('public.order_audit_events table'),
      ('public.update_admin_order function')
  ) AS expected(name)
  WHERE (
    expected.name = 'public.order_audit_events table'
    AND to_regclass('public.order_audit_events') IS NULL
  )
  OR (
    expected.name = 'public.update_admin_order function'
    AND to_regprocedure('public.update_admin_order(uuid,jsonb)') IS NULL
  )
  LIMIT 1;

  IF missing_object IS NOT NULL THEN
    RAISE EXCEPTION 'missing expected migration object: %', missing_object;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_audit_events'
      AND policyname = 'order_audit_events_select_policy'
  ) THEN
    RAISE EXCEPTION 'order audit select RLS policy missing';
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  v_customer_id uuid := '00000000-0000-4000-8000-00000000a301';
  v_merchant_id uuid := '00000000-0000-4000-8000-00000000a101';
  v_order_id uuid := '00000000-0000-4000-8000-00000000a401';
  v_order_item_id uuid := '00000000-0000-4000-8000-00000000a501';
  v_other_merchant_id uuid := '00000000-0000-4000-8000-00000000b101';
  v_other_product_id uuid := '00000000-0000-4000-8000-00000000b201';
  v_other_variant_id uuid := '00000000-0000-4000-8000-00000000b202';
  v_owner_user_id uuid := '00000000-0000-4000-8000-00000000a001';
  v_product_id uuid := '00000000-0000-4000-8000-00000000a201';
  v_staff_user_id uuid := '00000000-0000-4000-8000-00000000a002';
  v_variant_id uuid := '00000000-0000-4000-8000-00000000a202';
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
  ) VALUES
    (
      v_owner_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'order-edit-owner@example.com',
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
      'order-edit-staff@example.com',
      'test',
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{}'::jsonb
    );

  INSERT INTO public.merchants (
    id,
    user_id,
    email,
    business_name,
    slug
  ) VALUES
    (
      v_merchant_id,
      v_owner_user_id,
      'order-edit-merchant@example.com',
      'Order Edit Merchant',
      'order-edit-merchant'
    ),
    (
      v_other_merchant_id,
      NULL,
      'order-edit-other@example.com',
      'Order Edit Other',
      'order-edit-other'
    );

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
    'order-edit-staff@example.com',
    'Order Edit Staff',
    'sales_rep',
    '{"orders": {"edit": true, "view": true}}'::jsonb,
    'active'
  );

  INSERT INTO public.customers (
    id,
    merchant_id,
    email,
    full_name,
    phone
  ) VALUES (
    v_customer_id,
    v_merchant_id,
    'ada@example.com',
    'Ada Buyer',
    '+2348012345678'
  );

  INSERT INTO public.products (
    id,
    merchant_id,
    name,
    price,
    status
  ) VALUES
    (
      v_product_id,
      v_merchant_id,
      'Samsung Galaxy S26',
      1000000,
      'active'
    ),
    (
      v_other_product_id,
      v_other_merchant_id,
      'Other Merchant Phone',
      1000000,
      'active'
    );

  INSERT INTO public.product_variants (
    id,
    product_id,
    merchant_id,
    attributes,
    condition,
    price_override,
    sku
  ) VALUES
    (
      v_variant_id,
      v_product_id,
      v_merchant_id,
      '{"color": "Black", "storage": "512GB"}'::jsonb,
      'new',
      1270000,
      'S26-BLK-512'
    ),
    (
      v_other_variant_id,
      v_other_product_id,
      v_other_merchant_id,
      '{"color": "Blue", "storage": "128GB"}'::jsonb,
      'new',
      990000,
      'OTHER-BLUE-128'
    );

  INSERT INTO public.orders (
    id,
    merchant_id,
    customer_id,
    order_number,
    customer_name,
    customer_email,
    customer_phone,
    shipping_status,
    payment_status,
    subtotal,
    shipping_fee,
    discount_amount,
    tax_amount,
    gift_wrapping_fee,
    tax_basis,
    total,
    shipping_address,
    source,
    notes
  ) VALUES (
    v_order_id,
    v_merchant_id,
    v_customer_id,
    'ORD-EDIT-001',
    'Ada Buyer',
    'ada@example.com',
    '+2348012345678',
    'pending',
    'unpaid',
    1000000,
    2500,
    0,
    0,
    0,
    'exclusive',
    1002500,
    '{"address": "12 Allen Avenue", "name": "Ada Buyer", "phone": "+2348012345678", "city": "Ikeja", "state": "Lagos"}'::jsonb,
    'physical',
    'Original note'
  );

  INSERT INTO public.order_items (
    id,
    order_id,
    product_id,
    variant_id,
    variant_name,
    name,
    price,
    quantity,
    condition,
    image_url,
    item_description,
    variant_attributes,
    product_match_status
  ) VALUES (
    v_order_item_id,
    v_order_id,
    v_product_id,
    v_variant_id,
    'Black / 512GB',
    'Samsung Galaxy S26',
    1000000,
    1,
    'new',
    'https://cdn.example.test/s26.jpg',
    'Original snapshot',
    '{"color": "Black", "storage": "512GB"}'::jsonb,
    'linked'
  );
END;
$$ LANGUAGE plpgsql;

SET LOCAL ROLE anon;
DO $$
DECLARE
  v_order_id uuid := '00000000-0000-4000-8000-00000000a401';
BEGIN
  BEGIN
    PERFORM public.update_admin_order(v_order_id, '{}'::jsonb);
    RAISE EXCEPTION 'anon unexpectedly executed update_admin_order';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$ LANGUAGE plpgsql;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_order_id uuid := '00000000-0000-4000-8000-00000000a401';
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);

  BEGIN
    PERFORM public.update_admin_order(v_order_id, '{}'::jsonb);
    RAISE EXCEPTION 'authenticated role without auth.uid unexpectedly edited order';
  EXCEPTION WHEN invalid_authorization_specification THEN
    IF SQLERRM NOT LIKE '%not_authenticated%' THEN
      RAISE;
    END IF;
  END;
END;
$$ LANGUAGE plpgsql;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_customer_id uuid := '00000000-0000-4000-8000-00000000a301';
  v_merchant_id uuid := '00000000-0000-4000-8000-00000000a101';
  v_order_id uuid := '00000000-0000-4000-8000-00000000a401';
  v_other_product_id uuid := '00000000-0000-4000-8000-00000000b201';
  v_owner_user_id uuid := '00000000-0000-4000-8000-00000000a001';
  v_product_id uuid := '00000000-0000-4000-8000-00000000a201';
  v_result jsonb;
  v_variant_id uuid := '00000000-0000-4000-8000-00000000a202';
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_owner_user_id::text, true);

  BEGIN
    INSERT INTO public.order_audit_events (
      merchant_id,
      order_id,
      actor_user_id,
      action,
      changed_fields,
      before_snapshot,
      after_snapshot
    ) VALUES (
      v_merchant_id,
      v_order_id,
      v_owner_user_id,
      'order.update',
      ARRAY['notes'],
      '{}'::jsonb,
      '{}'::jsonb
    );
    RAISE EXCEPTION 'authenticated role unexpectedly inserted order audit event';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  DELETE FROM public.order_items WHERE order_id = v_order_id;
  IF NOT EXISTS (
    SELECT 1
    FROM public.order_items
    WHERE order_id = v_order_id
  ) THEN
    RAISE EXCEPTION 'authenticated role unexpectedly deleted order items directly';
  END IF;

  BEGIN
    PERFORM public.update_admin_order(
      v_order_id,
      jsonb_build_object(
        'branch_id', null,
        'customer', jsonb_build_object(
          'id', v_customer_id,
          'name', 'Ada Buyer',
          'email', 'ada@example.com',
          'phone', '+2348012345678'
        ),
        'discount_amount', 0,
        'gift_wrapping_fee', 0,
        'items', jsonb_build_array(
          jsonb_build_object(
            'condition', 'new',
            'image_url', 'https://cdn.example.test/s26.jpg',
            'item_description', 'Original snapshot',
            'name', 'Samsung Galaxy S26',
            'price', 1000000,
            'product_id', 'not-a-uuid',
            'product_match_status', 'linked',
            'quantity', 1,
            'variant_id', v_variant_id,
            'variant_attributes', '{"color": "Black", "storage": "512GB"}'::jsonb,
            'variant_name', 'Black / 512GB'
          )
        ),
        'notes', 'Original note',
        'notify_customer', false,
        'shipping_address', jsonb_build_object(
          'address', '12 Allen Avenue',
          'city', 'Ikeja',
          'name', 'Ada Buyer',
          'phone', '+2348012345678',
          'state', 'Lagos'
        ),
        'shipping_fee', 2500,
        'source', 'physical',
        'tax_amount', 0
      )
    );
    RAISE EXCEPTION 'malformed product id unexpectedly accepted';
  EXCEPTION WHEN data_exception THEN
    IF SQLERRM NOT LIKE '%order_item_product_invalid%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    PERFORM public.update_admin_order(
      v_order_id,
      jsonb_build_object(
        'branch_id', null,
        'customer', jsonb_build_object(
          'id', v_customer_id,
          'name', 'Ada Buyer',
          'email', 'ada@example.com',
          'phone', '+2348012345678'
        ),
        'discount_amount', 0,
        'gift_wrapping_fee', 0,
        'items', jsonb_build_array(
          jsonb_build_object(
            'condition', 'new',
            'image_url', 'https://cdn.example.test/s26.jpg',
            'item_description', 'Original snapshot',
            'name', 'Samsung Galaxy S26',
            'price', 1000000,
            'product_id', v_other_product_id,
            'product_match_status', 'linked',
            'quantity', 1,
            'variant_id', null,
            'variant_attributes', '{}'::jsonb,
            'variant_name', null
          )
        ),
        'notes', 'Original note',
        'notify_customer', false,
        'shipping_address', jsonb_build_object(
          'address', '12 Allen Avenue',
          'city', 'Ikeja',
          'name', 'Ada Buyer',
          'phone', '+2348012345678',
          'state', 'Lagos'
        ),
        'shipping_fee', 2500,
        'source', 'physical',
        'tax_amount', 0
      )
    );
    RAISE EXCEPTION 'cross-merchant product unexpectedly accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE '%order_item_product_forbidden%' THEN
      RAISE;
    END IF;
  END;

  v_result := public.update_admin_order(
    v_order_id,
    jsonb_build_object(
      'branch_id', null,
      'customer', jsonb_build_object(
        'id', v_customer_id,
        'name', 'Ada Buyer',
        'email', 'ada@example.com',
        'phone', '+2348012345678'
      ),
      'discount_amount', 0,
      'gift_wrapping_fee', 0,
      'items', jsonb_build_array(
        jsonb_build_object(
          'condition', null,
          'image_url', null,
          'item_description', 'Manual add-on',
          'name', 'Custom setup service',
          'price', 5000,
          'product_id', null,
          'quantity', 1,
          'variant_id', null,
          'variant_attributes', null,
          'variant_name', null
        )
      ),
      'notes', 'Original note',
      'notify_customer', false,
      'shipping_address', jsonb_build_object(
        'address', '12 Allen Avenue',
        'city', 'Ikeja',
        'name', 'Ada Buyer',
        'phone', '+2348012345678',
        'state', 'Lagos'
      ),
      'shipping_fee', 2500,
      'source', 'physical',
      'tax_amount', 0
    )
  );

  IF v_result ->> 'change_category' <> 'financial' THEN
    RAISE EXCEPTION 'expected custom line edit to be financial, got %', v_result;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.order_items
    WHERE order_id = v_order_id
      AND product_id IS NULL
      AND product_match_status = 'custom'
      AND name = 'Custom setup service'
  ) THEN
    RAISE EXCEPTION 'custom line item default did not persist as custom';
  END IF;

  v_result := public.update_admin_order(
    v_order_id,
    jsonb_build_object(
      'branch_id', null,
      'customer', jsonb_build_object(
        'id', v_customer_id,
        'name', 'Ada Buyer',
        'email', 'ada@example.com',
        'phone', '+2348099999999'
      ),
      'discount_amount', 0,
      'gift_wrapping_fee', 0,
      'items', jsonb_build_array(
        jsonb_build_object(
          'condition', 'new',
          'image_url', 'https://cdn.example.test/s26-updated.jpg',
          'item_description', 'Updated snapshot',
          'name', 'Samsung Galaxy S26',
          'price', 1000000,
          'product_id', v_product_id,
          'product_match_status', 'linked',
          'quantity', 2,
          'variant_id', v_variant_id,
          'variant_attributes', '{"color": "Black", "storage": "512GB"}'::jsonb,
          'variant_name', 'Black / 512GB'
        )
      ),
      'notes', 'Updated note',
      'notify_customer', true,
      'shipping_address', jsonb_build_object(
        'address', '12 Allen Avenue',
        'city', 'Ikeja',
        'name', 'Ada Buyer',
        'phone', '+2348099999999',
        'state', 'Lagos'
      ),
      'shipping_fee', 2500,
      'source', 'physical',
      'tax_amount', 0
    )
  );

  IF v_result ->> 'change_category' <> 'financial' THEN
    RAISE EXCEPTION 'expected financial change category, got %', v_result;
  END IF;

  IF (v_result ->> 'notify_customer')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'expected notify_customer true, got %', v_result;
  END IF;

  IF (
    SELECT count(*)
    FROM public.order_items
    WHERE order_id = v_order_id
  ) <> 1 THEN
    RAISE EXCEPTION 'item replacement did not leave exactly one order item';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.order_items
    WHERE order_id = v_order_id
      AND quantity = 2
      AND image_url = 'https://cdn.example.test/s26-updated.jpg'
      AND item_description = 'Updated snapshot'
      AND variant_attributes = '{"color": "Black", "storage": "512GB"}'::jsonb
      AND product_match_status = 'linked'
  ) THEN
    RAISE EXCEPTION 'item replacement did not preserve expected snapshot fields';
  END IF;

  IF (
    SELECT count(*)
    FROM public.order_audit_events
    WHERE order_id = v_order_id
      AND action = 'order.update'
      AND change_category = 'financial'
  ) <> 2 THEN
    RAISE EXCEPTION 'expected two audit events after successful edits';
  END IF;

  UPDATE public.orders
  SET payment_status = 'paid'
  WHERE id = v_order_id;

  BEGIN
    PERFORM public.update_admin_order(
      v_order_id,
      jsonb_build_object(
        'branch_id', null,
        'customer', jsonb_build_object(
          'id', v_customer_id,
          'name', 'Ada Buyer',
          'email', 'ada@example.com',
          'phone', '+2348099999999'
        ),
        'discount_amount', 0,
        'gift_wrapping_fee', 0,
        'items', jsonb_build_array(
          jsonb_build_object(
            'condition', 'new',
            'image_url', 'https://cdn.example.test/s26-updated.jpg',
            'item_description', 'Updated snapshot',
            'name', 'Samsung Galaxy S26',
            'price', 900000,
            'product_id', v_product_id,
            'product_match_status', 'linked',
            'quantity', 2,
            'variant_id', v_variant_id,
            'variant_attributes', '{"color": "Black", "storage": "512GB"}'::jsonb,
            'variant_name', 'Black / 512GB'
          )
        ),
        'notes', 'Updated note',
        'notify_customer', false,
        'shipping_address', jsonb_build_object(
          'address', '12 Allen Avenue',
          'city', 'Ikeja',
          'name', 'Ada Buyer',
          'phone', '+2348099999999',
          'state', 'Lagos'
        ),
        'shipping_fee', 2500,
        'source', 'physical',
        'tax_amount', 0
      )
    );
    RAISE EXCEPTION 'paid financial edit unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%order_financial_edit_has_payments%' THEN
      RAISE;
    END IF;
  END;
END;
$$ LANGUAGE plpgsql;
RESET ROLE;

ROLLBACK;
