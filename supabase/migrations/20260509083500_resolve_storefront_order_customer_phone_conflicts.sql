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
  v_trimmed_customer_name TEXT := trim(p_customer_name);
  v_normalized_customer_email TEXT := lower(trim(p_customer_email));
  v_normalized_customer_phone TEXT := NULLIF(trim(COALESCE(p_customer_phone, '')), '');
  v_subtotal NUMERIC := 0;
  v_shipping_fee NUMERIC := COALESCE(p_shipping_fee, 0);
  v_discount_amount NUMERIC := GREATEST(COALESCE(p_discount_amount, 0), 0);
  v_tax_amount NUMERIC := COALESCE(p_tax_amount, 0);
  v_total NUMERIC := 0;
  v_payment_method TEXT := p_payment_method;
  v_payment_status TEXT := 'unpaid';
  v_shipping_status TEXT := p_shipping_status;
  v_shipping_address JSONB := p_shipping_address;
  v_user_id UUID := auth.uid();
  v_customer_record_phone TEXT;
  v_invalid_item_count INTEGER;
  v_invalid_quantity_count INTEGER;
  v_invalid_variant_count INTEGER;
  stock_rec RECORD;
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

  IF public.is_agentic_checkout_context() THEN
    -- Agentic checkout uses a server-signed merchant-scoped JWT, not a
    -- customer auth session. Keep customers.user_id NULL for agentic buyers.
    p_user_id := NULL;
  ELSIF v_user_id IS NOT NULL THEN
    IF p_user_id IS NULL THEN
      p_user_id := v_user_id;
    ELSIF p_user_id <> v_user_id THEN
      RAISE EXCEPTION 'user_id_mismatch';
    END IF;
  ELSIF p_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'cannot_set_user_id_anonymously';
  END IF;

  IF p_payment_status IS NOT NULL AND trim(p_payment_status) <> '' THEN
    v_payment_status := lower(trim(p_payment_status));

    IF v_payment_status NOT IN ('unpaid', 'pending') THEN
      RAISE EXCEPTION 'invalid_payment_status';
    END IF;
  END IF;

  PERFORM 1 FROM merchants m WHERE m.id = p_merchant_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found';
  END IF;

  v_first_name := split_part(v_trimmed_customer_name, ' ', 1);
  IF position(' ' in v_trimmed_customer_name) > 0 THEN
    v_last_name := trim(substring(v_trimmed_customer_name from position(' ' in v_trimmed_customer_name) + 1));
  ELSE
    v_last_name := NULL;
  END IF;

  DROP TABLE IF EXISTS pg_temp.tmp_storefront_order_items;

  CREATE TEMP TABLE tmp_storefront_order_items (
    product_id UUID,
    condition TEXT,
    image_url TEXT,
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

  INSERT INTO tmp_storefront_order_items (
    product_id,
    condition,
    image_url,
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
    r.image_url,
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
      NULLIF(trim(COALESCE(item->>'image_url', item->>'imageUrl')), '') AS image_url,
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
  v_tax_amount := GREATEST(v_tax_amount, 0);
  v_total := v_subtotal + v_shipping_fee + v_tax_amount - v_discount_amount;
  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  IF v_normalized_customer_phone IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext(p_merchant_id::text),
      hashtext(v_normalized_customer_phone)
    );
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT c.id
      INTO v_customer_id
    FROM customers c
    WHERE c.merchant_id = p_merchant_id
      AND c.user_id = p_user_id
    ORDER BY c.id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF p_user_id IS NULL AND v_normalized_customer_phone IS NOT NULL THEN
    SELECT c.id
      INTO v_customer_id
    FROM customers c
    WHERE c.merchant_id = p_merchant_id
      AND c.phone = v_normalized_customer_phone
      AND c.user_id IS NULL
    ORDER BY c.id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_customer_id IS NOT NULL THEN
    UPDATE customers c
    SET
      email = CASE
        WHEN (c.email IS NULL OR c.email = '')
          AND NOT EXISTS (
            SELECT 1
            FROM customers existing_email
            WHERE existing_email.merchant_id = p_merchant_id
              AND lower(existing_email.email) = v_normalized_customer_email
              AND existing_email.id <> c.id
          )
          THEN v_normalized_customer_email
        ELSE c.email
      END,
      phone = CASE
        WHEN v_normalized_customer_phone IS NULL THEN c.phone
        WHEN c.phone = v_normalized_customer_phone THEN c.phone
        WHEN NOT EXISTS (
          SELECT 1
          FROM customers existing_phone
          WHERE existing_phone.merchant_id = p_merchant_id
            AND existing_phone.phone = v_normalized_customer_phone
            AND existing_phone.id <> c.id
        )
          THEN v_normalized_customer_phone
        ELSE c.phone
      END,
      user_id = CASE
        WHEN c.user_id IS NULL THEN p_user_id
        ELSE c.user_id
      END,
      first_name = COALESCE(c.first_name, v_first_name),
      last_name = COALESCE(c.last_name, v_last_name)
    WHERE c.id = v_customer_id
    RETURNING c.id INTO v_customer_id;
  ELSE
    v_customer_record_phone := v_normalized_customer_phone;

    IF v_normalized_customer_phone IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM customers existing_phone
        WHERE existing_phone.merchant_id = p_merchant_id
          AND existing_phone.phone = v_normalized_customer_phone
      )
    THEN
      v_customer_record_phone := NULL;
    END IF;

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
      v_normalized_customer_email,
      v_first_name,
      v_last_name,
      v_customer_record_phone,
      p_user_id
    )
    ON CONFLICT ON CONSTRAINT customers_merchant_id_email_key
    DO UPDATE SET
      phone = CASE
        WHEN EXCLUDED.phone IS NULL THEN customers.phone
        WHEN customers.phone IS NULL OR customers.phone = '' THEN EXCLUDED.phone
        WHEN customers.phone = EXCLUDED.phone THEN customers.phone
        ELSE customers.phone
      END,
      user_id = COALESCE(customers.user_id, EXCLUDED.user_id),
      first_name = COALESCE(customers.first_name, EXCLUDED.first_name),
      last_name = COALESCE(customers.last_name, EXCLUDED.last_name)
    RETURNING customers.id INTO v_customer_id;
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
    v_normalized_customer_email,
    v_trimmed_customer_name,
    v_normalized_customer_phone,
    v_subtotal,
    v_shipping_fee,
    v_discount_amount,
    v_tax_amount,
    v_total,
    v_payment_method,
    v_payment_status,
    v_shipping_status,
    v_shipping_address,
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
    orders.tracking_token,
    orders.payment_method,
    orders.shipping_status,
    orders.shipping_address
  INTO
    v_order_id,
    v_order_number,
    v_tracking_token,
    v_payment_method,
    v_shipping_status,
    v_shipping_address;

  FOR stock_rec IN
    SELECT
      t.product_id,
      t.variant_id,
      SUM(t.quantity)::INTEGER AS total_quantity,
      BOOL_OR(t.manage_stock) AS manage_stock
    FROM tmp_storefront_order_items t
    GROUP BY t.product_id, t.variant_id
    ORDER BY t.product_id, t.variant_id
  LOOP
    IF stock_rec.manage_stock THEN
      IF stock_rec.variant_id IS NOT NULL THEN
        UPDATE product_variants
        SET stock_quantity = stock_quantity - stock_rec.total_quantity
        WHERE product_variants.id = stock_rec.variant_id
          AND stock_quantity >= stock_rec.total_quantity;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'insufficient_variant_stock';
        END IF;
      ELSE
        UPDATE products
        SET stock_quantity = stock_quantity - stock_rec.total_quantity
        WHERE products.id = stock_rec.product_id
          AND stock_quantity >= stock_rec.total_quantity;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'insufficient_stock';
        END IF;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO order_items (
    order_id,
    product_id,
    condition,
    image_url,
    variant_id,
    variant_name,
    name,
    price,
    quantity,
    has_assurance,
    assurance_fee
  )
  SELECT
    v_order_id,
    t.product_id,
    t.condition,
    t.image_url,
    t.variant_id,
    t.variant_name,
    t.product_name,
    COALESCE(t.price_override, t.base_price),
    t.quantity,
    t.has_assurance,
    t.assurance_fee
  FROM tmp_storefront_order_items t;

  RETURN QUERY
  SELECT
    v_order_id,
    v_order_number,
    v_tracking_token,
    v_subtotal,
    v_shipping_fee,
    v_discount_amount,
    v_tax_amount,
    v_total,
    v_customer_id,
    v_normalized_customer_email,
    v_trimmed_customer_name,
    v_normalized_customer_phone,
    v_payment_status,
    v_shipping_status,
    v_payment_method,
    v_shipping_address,
    p_merchant_id;
END;
$$;

COMMENT ON FUNCTION public.create_storefront_order(
  UUID,
  TEXT,
  TEXT,
  JSONB,
  TEXT,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  TEXT,
  TEXT,
  JSONB,
  UUID,
  TEXT,
  TEXT,
  UUID
) IS
  'Creates storefront orders. Agentic checkout JWTs are merchant-scoped and must not populate customers.user_id.';
