CREATE OR REPLACE FUNCTION public.create_storefront_order(
  p_merchant_id UUID,
  p_customer_email TEXT,
  p_customer_name TEXT,
  p_items JSONB,
  p_customer_phone TEXT DEFAULT NULL,
  p_shipping_fee NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_tax_amount NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'card',
  p_payment_status TEXT DEFAULT 'unpaid',
  p_shipping_status TEXT DEFAULT 'pending',
  p_shipping_address JSONB DEFAULT NULL,
  p_source TEXT DEFAULT 'online_store',
  p_notes TEXT DEFAULT NULL,
  p_ad_tracking JSONB DEFAULT NULL,
  p_selected_quote_id UUID DEFAULT NULL,
  p_shipping_provider TEXT DEFAULT NULL,
  p_tracking_number TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  tracking_token TEXT,
  subtotal NUMERIC,
  shipping_fee NUMERIC,
  discount_amount NUMERIC,
  tax_amount NUMERIC,
  total NUMERIC,
  customer_id UUID,
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  payment_status TEXT,
  shipping_status TEXT,
  payment_method TEXT,
  shipping_address JSONB,
  merchant_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_tracking_token TEXT;
  v_customer_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_subtotal NUMERIC := 0;
  v_shipping_fee NUMERIC := COALESCE(p_shipping_fee, 0);
  v_discount_amount NUMERIC := COALESCE(p_discount_amount, 0);
  v_tax_amount NUMERIC := COALESCE(p_tax_amount, 0);
  v_total NUMERIC := 0;
  v_user_id UUID := auth.uid();
  v_invalid_item_count INTEGER;
  v_invalid_quantity_count INTEGER;
  v_invalid_variant_count INTEGER;
  item_rec RECORD;
  v_current_stock INTEGER;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF p_customer_email IS NULL OR trim(p_customer_email) = '' THEN
    RAISE EXCEPTION 'customer_email_required';
  END IF;

  IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'customer_name_required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items_required';
  END IF;

  IF v_user_id IS NOT NULL THEN
    IF p_user_id IS NULL THEN
      p_user_id := v_user_id;
    ELSIF p_user_id <> v_user_id THEN
      RAISE EXCEPTION 'user_id_mismatch';
    END IF;
  END IF;

  PERFORM 1 FROM merchants m WHERE m.id = p_merchant_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found';
  END IF;

  v_first_name := split_part(trim(p_customer_name), ' ', 1);
  IF position(' ' in trim(p_customer_name)) > 0 THEN
    v_last_name := trim(substring(trim(p_customer_name) from position(' ' in trim(p_customer_name)) + 1));
  ELSE
    v_last_name := NULL;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS tmp_storefront_order_items (
    product_id UUID,
    condition TEXT,
    variant_id UUID,
    variant_attributes JSONB,
    variant_name TEXT,
    quantity INTEGER,
    has_assurance BOOLEAN,
    assurance_fee NUMERIC,
    product_name TEXT,
    base_price NUMERIC,
    price_override NUMERIC,
    manage_stock BOOLEAN,
    variant_stock INTEGER
  ) ON COMMIT DROP;

  TRUNCATE TABLE tmp_storefront_order_items;

  INSERT INTO tmp_storefront_order_items (
    product_id,
    condition,
    variant_id,
    variant_attributes,
    variant_name,
    quantity,
    has_assurance,
    assurance_fee,
    product_name,
    base_price,
    price_override,
    manage_stock,
    variant_stock
  )
  SELECT
    r.product_id,
    COALESCE(NULLIF(trim(r.condition), ''), p.condition),
    r.variant_id,
    r.variant_attributes,
    COALESCE(
      public.format_order_item_variant_name(v.attributes),
      public.format_order_item_variant_name(r.variant_attributes)
    ),
    r.quantity,
    r.has_assurance,
    r.assurance_fee,
    p.name,
    p.price,
    v.price_override,
    p.manage_stock,
    v.stock_quantity
  FROM (
    SELECT
      COALESCE(
        NULLIF(item->>'product_id','')::uuid,
        NULLIF(item->>'productId','')::uuid,
        NULLIF(item->>'id','')::uuid
      ) AS product_id,
      NULLIF(trim(item->>'condition'), '') AS condition,
      NULLIF(item->>'variant_id','')::uuid AS variant_id,
      COALESCE(item->'variant_attributes', item->'variantAttributes') AS variant_attributes,
      (item->>'quantity')::int AS quantity,
      COALESCE((item->>'has_assurance')::boolean, false) AS has_assurance,
      GREATEST(COALESCE((item->>'assurance_fee')::numeric, 0), 0) AS assurance_fee
    FROM jsonb_array_elements(p_items) AS item
  ) AS r
  LEFT JOIN products p ON p.id = r.product_id
    AND p.merchant_id = p_merchant_id
    AND p.status = 'active'
  LEFT JOIN product_variants v
    ON r.variant_id IS NOT NULL
    AND v.id = r.variant_id
    AND v.product_id = p.id;

  SELECT
    COUNT(*) FILTER (WHERE t.product_id IS NULL OR t.product_name IS NULL) AS invalid_item_count,
    COUNT(*) FILTER (WHERE t.quantity IS NULL OR t.quantity <= 0) AS invalid_quantity_count,
    COUNT(*) FILTER (
      WHERE t.variant_id IS NOT NULL AND t.variant_stock IS NULL
    ) AS invalid_variant_count
  INTO v_invalid_item_count, v_invalid_quantity_count, v_invalid_variant_count
  FROM tmp_storefront_order_items t;

  IF v_invalid_item_count > 0 THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  IF v_invalid_quantity_count > 0 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  IF v_invalid_variant_count > 0 THEN
    RAISE EXCEPTION 'invalid_variant';
  END IF;

  SELECT COALESCE(SUM((COALESCE(t.price_override, t.base_price) * t.quantity) + t.assurance_fee), 0)
    INTO v_subtotal
  FROM tmp_storefront_order_items t;

  v_shipping_fee := GREATEST(v_shipping_fee, 0);
  v_discount_amount := GREATEST(v_discount_amount, 0);
  v_tax_amount := GREATEST(v_tax_amount, 0);
  v_discount_amount := LEAST(v_discount_amount, v_subtotal);
  v_total := v_subtotal + v_shipping_fee + v_tax_amount - v_discount_amount;
  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  SELECT c.id INTO v_customer_id
  FROM customers c
  WHERE c.merchant_id = p_merchant_id
    AND lower(c.email) = lower(trim(p_customer_email))
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO customers (
      merchant_id,
      email,
      first_name,
      last_name,
      phone,
      user_id
    )
    VALUES (
      p_merchant_id,
      lower(trim(p_customer_email)),
      v_first_name,
      v_last_name,
      p_customer_phone,
      p_user_id
    )
    RETURNING customers.id INTO v_customer_id;
  ELSE
    UPDATE customers
    SET
      phone = COALESCE(p_customer_phone, phone),
      user_id = COALESCE(user_id, p_user_id),
      first_name = COALESCE(first_name, v_first_name),
      last_name = COALESCE(last_name, v_last_name)
    WHERE customers.id = v_customer_id;
  END IF;

  INSERT INTO orders (
    merchant_id,
    customer_id,
    customer_email,
    customer_name,
    customer_phone,
    subtotal,
    shipping_fee,
    discount_amount,
    tax_amount,
    total,
    payment_method,
    payment_status,
    shipping_status,
    shipping_address,
    source,
    notes,
    ad_tracking,
    selected_quote_id,
    shipping_provider,
    tracking_number
  )
  VALUES (
    p_merchant_id,
    v_customer_id,
    lower(trim(p_customer_email)),
    p_customer_name,
    p_customer_phone,
    v_subtotal,
    v_shipping_fee,
    v_discount_amount,
    v_tax_amount,
    v_total,
    p_payment_method,
    p_payment_status,
    p_shipping_status,
    p_shipping_address,
    p_source,
    p_notes,
    p_ad_tracking,
    p_selected_quote_id,
    p_shipping_provider,
    p_tracking_number
  )
  RETURNING
    orders.id,
    orders.order_number,
    orders.tracking_token
  INTO v_order_id, v_order_number, v_tracking_token;

  FOR item_rec IN
    SELECT *
    FROM tmp_storefront_order_items
  LOOP
    IF item_rec.manage_stock THEN
      IF item_rec.variant_id IS NOT NULL THEN
        UPDATE product_variants
        SET stock_quantity = stock_quantity - item_rec.quantity
        WHERE product_variants.id = item_rec.variant_id
          AND stock_quantity >= item_rec.quantity
        RETURNING stock_quantity INTO v_current_stock;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'insufficient_variant_stock';
        END IF;
      ELSE
        UPDATE products
        SET stock_quantity = stock_quantity - item_rec.quantity
        WHERE products.id = item_rec.product_id
          AND stock_quantity >= item_rec.quantity
        RETURNING stock_quantity INTO v_current_stock;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'insufficient_stock';
        END IF;
      END IF;
    END IF;

    INSERT INTO order_items (
      order_id,
      product_id,
      condition,
      variant_id,
      variant_name,
      name,
      price,
      quantity,
      has_assurance,
      assurance_fee
    )
    VALUES (
      v_order_id,
      item_rec.product_id,
      item_rec.condition,
      item_rec.variant_id,
      item_rec.variant_name,
      item_rec.product_name,
      COALESCE(item_rec.price_override, item_rec.base_price),
      item_rec.quantity,
      item_rec.has_assurance,
      item_rec.assurance_fee
    );
  END LOOP;

  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.tracking_token,
    o.subtotal,
    o.shipping_fee,
    o.discount_amount,
    o.tax_amount,
    o.total,
    o.customer_id,
    o.customer_email,
    o.customer_name,
    o.customer_phone,
    o.payment_status,
    o.shipping_status,
    o.payment_method,
    o.shipping_address,
    o.merchant_id
  FROM orders o
  WHERE o.id = v_order_id;
END;
$$;
