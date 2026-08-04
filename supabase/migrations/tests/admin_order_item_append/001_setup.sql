DO $setup$
DECLARE
  v_addon_product_id uuid := '00000000-0000-4000-8000-00000000c203';
  v_addon_variant_id uuid := '00000000-0000-4000-8000-00000000c204';
  v_customer_id uuid := '00000000-0000-4000-8000-00000000c301';
  v_merchant_id uuid := '00000000-0000-4000-8000-00000000c101';
  v_order_id uuid := '00000000-0000-4000-8000-00000000c401';
  v_order_item_id uuid := '00000000-0000-4000-8000-00000000c501';
  v_owner_user_id uuid := '00000000-0000-4000-8000-00000000c001';
  v_product_id uuid := '00000000-0000-4000-8000-00000000c201';
  v_variant_id uuid := '00000000-0000-4000-8000-00000000c202';
BEGIN
  IF to_regprocedure('public.update_admin_order(uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'public.update_admin_order function is missing';
  END IF;

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
    'order-item-append-owner@example.com',
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
  ) VALUES (
    v_merchant_id,
    v_owner_user_id,
    'order-item-append-merchant@example.com',
    'Order Item Append Merchant',
    'order-item-append-merchant'
  );

  UPDATE public.merchants
  SET vat_registration_status = 'unregistered'
  WHERE id = v_merchant_id;

  INSERT INTO public.customers (
    id,
    merchant_id,
    email,
    full_name,
    phone
  ) VALUES (
    v_customer_id,
    v_merchant_id,
    'append-buyer@example.com',
    'Append Buyer',
    '+2348012345678'
  );

  INSERT INTO public.products (
    id,
    merchant_id,
    name,
    price,
    manage_stock,
    status,
    vat_category_code,
    vat_rate
  ) VALUES
    (
      v_product_id,
      v_merchant_id,
      'Append Protected Phone',
      1000000,
      false,
      'active',
      'S',
      7.5
    ),
    (
      v_addon_product_id,
      v_merchant_id,
      'Append USB-C Power Adapter',
      40000,
      false,
      'active',
      'Z',
      0
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
      1000000,
      'APPEND-PHONE'
    ),
    (
      v_addon_variant_id,
      v_addon_product_id,
      v_merchant_id,
      '{"wattage": "61W"}'::jsonb,
      'new',
      40000,
      'APPEND-USB-C'
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
    'ORD-APPEND-001',
    'Append Buyer',
    'append-buyer@example.com',
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
    '{"address": "12 Allen Avenue", "name": "Append Buyer", "phone": "+2348012345678", "city": "Ikeja", "state": "Lagos"}'::jsonb,
    'physical',
    'Append fixture order'
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
    'Append Protected Phone',
    1000000,
    1,
    'new',
    'https://cdn.example.test/append-phone.jpg',
    'Protected accounting snapshot',
    '{"color": "Black", "storage": "512GB"}'::jsonb,
    'linked'
  );
END;
$setup$ LANGUAGE plpgsql;
