ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS variant_name TEXT;

COMMENT ON COLUMN public.order_items.variant_id IS 'Optional linked product variant chosen at checkout/import time';
COMMENT ON COLUMN public.order_items.variant_name IS 'Display snapshot of the chosen variant at order time';

CREATE INDEX IF NOT EXISTS idx_order_items_variant_id
ON public.order_items(variant_id)
WHERE variant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.format_order_item_variant_name(
  p_attributes JSONB
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT NULLIF(
    string_agg(
      btrim(attribute.value),
      ' / ' ORDER BY lower(attribute.key), attribute.key
    ),
    ''
  )
  FROM jsonb_each_text(COALESCE(p_attributes, '{}'::jsonb)) AS attribute
  WHERE NULLIF(btrim(attribute.value), '') IS NOT NULL;
$$;

COMMENT ON FUNCTION public.format_order_item_variant_name(JSONB) IS
  'Formats variant attribute JSON into a stable human-readable order item label';

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
    IF p_user_id IS NOT NULL AND p_user_id <> v_user_id THEN
      RAISE EXCEPTION 'user_id_mismatch';
    END IF;

    p_user_id := v_user_id;
  ELSE
    p_user_id := NULL;
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
      COALESCE(p_user_id, v_user_id)
    )
    RETURNING customers.id INTO v_customer_id;
  ELSE
    UPDATE customers c2
    SET
      phone = COALESCE(p_customer_phone, c2.phone),
      user_id = COALESCE(c2.user_id, p_user_id, v_user_id),
      first_name = COALESCE(c2.first_name, v_first_name),
      last_name = COALESCE(c2.last_name, v_last_name)
    WHERE c2.id = v_customer_id;
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
    COALESCE(p_payment_method, 'card'),
    COALESCE(p_payment_status, 'unpaid'),
    COALESCE(p_shipping_status, 'pending'),
    p_shipping_address,
    COALESCE(p_source, 'online_store'),
    p_notes,
    p_ad_tracking,
    p_selected_quote_id,
    p_shipping_provider,
    p_tracking_number
  )
  RETURNING orders.id, orders.order_number, orders.tracking_token
    INTO v_order_id, v_order_number, v_tracking_token;

  IF COALESCE(p_payment_method, '') = 'pod' THEN
    INSERT INTO transactions (
      merchant_id,
      order_id,
      transaction_type,
      amount,
      currency,
      status,
      gateway,
      gateway_reference,
      platform_fee,
      merchant_amount,
      description,
      metadata
    )
    VALUES (
      p_merchant_id,
      v_order_id,
      'payment',
      v_total,
      'NGN',
      'pending',
      'pod',
      'POD-' || upper(substr(v_order_id::text, 1, 8)),
      0,
      v_total,
      'Pay on Delivery for order ' || COALESCE(v_order_number, v_order_id::text),
      jsonb_build_object(
        'customer_email', lower(trim(p_customer_email)),
        'customer_name', p_customer_name,
        'payment_type', 'pay_on_delivery'
      )
    );
  END IF;

  INSERT INTO order_items (
    order_id,
    product_id,
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
    t.variant_id,
    t.variant_name,
    t.product_name,
    COALESCE(t.price_override, t.base_price),
    t.quantity,
    t.has_assurance,
    t.assurance_fee
  FROM tmp_storefront_order_items t;

  FOR item_rec IN
    SELECT t.product_id, t.variant_id, t.quantity, t.manage_stock
    FROM tmp_storefront_order_items t
  LOOP
    IF COALESCE(item_rec.manage_stock, false) THEN
      IF item_rec.variant_id IS NOT NULL THEN
        SELECT pv.stock_quantity INTO v_current_stock
        FROM product_variants pv WHERE pv.id = item_rec.variant_id;

        IF v_current_stock IS NOT NULL THEN
          UPDATE product_variants pv
          SET stock_quantity = pv.stock_quantity - item_rec.quantity
          WHERE pv.id = item_rec.variant_id
            AND pv.stock_quantity >= item_rec.quantity;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'insufficient_stock';
          END IF;
        END IF;
      ELSE
        SELECT pr.stock_quantity INTO v_current_stock
        FROM products pr WHERE pr.id = item_rec.product_id;

        IF v_current_stock IS NOT NULL THEN
          UPDATE products pr
          SET stock_quantity = pr.stock_quantity - item_rec.quantity
          WHERE pr.id = item_rec.product_id
            AND pr.stock_quantity >= item_rec.quantity;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'insufficient_stock';
          END IF;
        END IF;
      END IF;
    END IF;
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

REVOKE EXECUTE ON FUNCTION public.create_storefront_order(
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
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_storefront_order(
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
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_order_tracking(
  p_merchant_slug TEXT,
  p_order_id UUID DEFAULT NULL,
  p_order_number TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_tracking_token TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  shipping_status TEXT,
  payment_status TEXT,
  subtotal NUMERIC,
  shipping_cost NUMERIC,
  discount_amount NUMERIC,
  total NUMERIC,
  currency TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  shipping_address JSONB,
  tracking_number TEXT,
  shipping_provider TEXT,
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  merchant_id UUID,
  merchant_business_name TEXT,
  merchant_slug TEXT,
  merchant_logo_url TEXT,
  merchant_support_email TEXT,
  merchant_support_phone TEXT,
  merchant_phone TEXT,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_order_id UUID;
  v_is_token_lookup BOOLEAN := FALSE;
BEGIN
  IF p_merchant_slug IS NULL OR trim(p_merchant_slug) = '' THEN
    RAISE EXCEPTION 'merchant_slug_required';
  END IF;

  IF p_tracking_token IS NOT NULL AND trim(p_tracking_token) != '' THEN
    v_is_token_lookup := TRUE;
    SELECT o.id INTO v_order_id
    FROM orders o
    JOIN merchants m ON m.id = o.merchant_id
    WHERE m.slug = p_merchant_slug
      AND o.tracking_token = p_tracking_token
    LIMIT 1;
  ELSE
    v_email := lower(trim(p_email));

    IF v_email IS NULL OR v_email = '' THEN
      RAISE EXCEPTION 'email_required';
    END IF;

    IF p_order_id IS NULL AND (p_order_number IS NULL OR trim(p_order_number) = '') THEN
      RAISE EXCEPTION 'order_id_or_number_required';
    END IF;

    SELECT o.id INTO v_order_id
    FROM orders o
    JOIN merchants m ON m.id = o.merchant_id
    WHERE m.slug = p_merchant_slug
      AND lower(o.customer_email) = v_email
      AND (
        (p_order_id IS NOT NULL AND o.id = p_order_id)
        OR (p_order_number IS NOT NULL AND o.order_number = p_order_number)
      )
    LIMIT 1;
  END IF;

  IF v_order_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.shipping_status,
    o.payment_status,
    o.subtotal,
    o.shipping_fee AS shipping_cost,
    o.discount_amount,
    o.total,
    o.currency,
    o.created_at,
    o.updated_at,
    o.customer_name,
    CASE WHEN v_is_token_lookup THEN
      CASE WHEN o.customer_email IS NULL OR o.customer_email = '' THEN '***'
           WHEN length(split_part(o.customer_email, '@', 1)) <= 2
             THEN left(split_part(o.customer_email, '@', 1), 1) || '***@' || split_part(o.customer_email, '@', 2)
           ELSE left(split_part(o.customer_email, '@', 1), 2) || '***@' || split_part(o.customer_email, '@', 2)
      END
    ELSE o.customer_email
    END AS customer_email,
    CASE WHEN v_is_token_lookup THEN
      CASE WHEN o.customer_phone IS NULL OR o.customer_phone = '' THEN ''
           WHEN length(o.customer_phone) <= 4 THEN '****'
           ELSE left(o.customer_phone, 4) || '****' || right(o.customer_phone, 2)
      END
    ELSE o.customer_phone
    END AS customer_phone,
    o.shipping_address,
    o.tracking_number,
    o.shipping_provider,
    o.paid_at,
    o.shipped_at,
    o.delivered_at,
    o.cancelled_at,
    m.id AS merchant_id,
    m.business_name AS merchant_business_name,
    m.slug AS merchant_slug,
    m.logo_url AS merchant_logo_url,
    m.support_email AS merchant_support_email,
    m.support_phone AS merchant_support_phone,
    m.phone AS merchant_phone,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'name', oi.name,
            'variant_name', oi.variant_name,
            'quantity', oi.quantity,
            'price', oi.price,
            'product_images', p.images
          )
        )
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
      ),
      '[]'::jsonb
    ) AS items
  FROM orders o
  JOIN merchants m ON m.id = o.merchant_id
  WHERE o.id = v_order_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_tracking(TEXT, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.get_order_tracking IS
  'Retrieve order tracking info by token or email + order identifier, including order item variant snapshots';
