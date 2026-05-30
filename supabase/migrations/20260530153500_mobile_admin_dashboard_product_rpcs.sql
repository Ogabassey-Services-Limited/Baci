CREATE OR REPLACE FUNCTION public.get_mobile_admin_dashboard_stats(
  p_merchant_id uuid,
  p_start_at timestamp with time zone DEFAULT NULL,
  p_previous_start_at timestamp with time zone DEFAULT NULL,
  p_previous_end_at timestamp with time zone DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_avg_order_value numeric := 0;
  v_caller_role text := COALESCE((SELECT auth.role()), '');
  v_new_customers bigint := 0;
  v_orders bigint := 0;
  v_pending_orders bigint := 0;
  v_previous_revenue numeric := 0;
  v_revenue numeric := 0;
  v_total_customers bigint := 0;
  v_total_items numeric := 0;
  v_visits bigint := 0;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF v_caller_role <> 'service_role' AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*)
  INTO v_orders
  FROM public.orders AS o
  WHERE o.merchant_id = p_merchant_id
    AND (p_start_at IS NULL OR o.created_at >= p_start_at)
    AND (p_branch_id IS NULL OR o.branch_id = p_branch_id);

  SELECT COUNT(*)
  INTO v_pending_orders
  FROM public.orders AS o
  WHERE o.merchant_id = p_merchant_id
    AND o.shipping_status = 'pending'
    AND (p_branch_id IS NULL OR o.branch_id = p_branch_id);

  SELECT COALESCE(SUM(COALESCE(oi.quantity, 1)), 0)
  INTO v_total_items
  FROM public.order_items AS oi
  INNER JOIN public.orders AS o ON o.id = oi.order_id
  WHERE o.merchant_id = p_merchant_id
    AND (p_start_at IS NULL OR o.created_at >= p_start_at)
    AND (p_branch_id IS NULL OR o.branch_id = p_branch_id);

  SELECT COUNT(*)
  INTO v_new_customers
  FROM public.customers AS c
  WHERE c.merchant_id = p_merchant_id
    AND (p_start_at IS NULL OR c.created_at >= p_start_at);

  SELECT COUNT(*)
  INTO v_total_customers
  FROM public.customers AS c
  WHERE c.merchant_id = p_merchant_id;

  SELECT COALESCE(SUM(COALESCE(o.total, 0)), 0)
  INTO v_revenue
  FROM public.orders AS o
  WHERE o.merchant_id = p_merchant_id
    AND (p_start_at IS NULL OR o.created_at >= p_start_at)
    AND (p_branch_id IS NULL OR o.branch_id = p_branch_id);

  IF p_previous_start_at IS NOT NULL AND p_previous_end_at IS NOT NULL THEN
    SELECT COALESCE(SUM(COALESCE(o.total, 0)), 0)
    INTO v_previous_revenue
    FROM public.orders AS o
    WHERE o.merchant_id = p_merchant_id
      AND o.created_at >= p_previous_start_at
      AND o.created_at < p_previous_end_at
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id);
  END IF;

  SELECT COUNT(*)
  INTO v_visits
  FROM public.analytics_events AS e
  WHERE e.merchant_id = p_merchant_id
    AND e.event_type = 'page_view'
    AND (p_start_at IS NULL OR e.created_at >= p_start_at);

  IF v_orders > 0 THEN
    v_avg_order_value := ROUND(v_revenue / v_orders);
  END IF;

  RETURN jsonb_build_object(
    'avgOrderValue', COALESCE(v_avg_order_value, 0),
    'newCustomers', COALESCE(v_new_customers, 0),
    'orders', COALESCE(v_orders, 0),
    'pendingOrders', COALESCE(v_pending_orders, 0),
    'previousPeriodRevenue', COALESCE(v_previous_revenue, 0),
    'revenue', COALESCE(v_revenue, 0),
    'totalCustomers', COALESCE(v_total_customers, 0),
    'totalItems', COALESCE(v_total_items, 0),
    'visits', COALESCE(v_visits, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_mobile_admin_revenue_chart(
  p_merchant_id uuid,
  p_buckets jsonb,
  p_branch_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role text := COALESCE((SELECT auth.role()), '');
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF p_buckets IS NULL OR jsonb_typeof(p_buckets) <> 'array' THEN
    RAISE EXCEPTION 'buckets_array_required' USING ERRCODE = '22023';
  END IF;

  IF v_caller_role <> 'service_role' AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH buckets AS (
      SELECT
        bucket.ordinal,
        bucket.label,
        bucket.start_at,
        bucket.end_at
      FROM jsonb_to_recordset(p_buckets) AS bucket(
        ordinal integer,
        label text,
        start_at timestamp with time zone,
        end_at timestamp with time zone
      )
    )
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'label', b.label,
          'value', COALESCE(bucket_revenue.value, 0)
        )
        ORDER BY b.ordinal
      ),
      '[]'::jsonb
    )
    FROM buckets AS b
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(COALESCE(o.total, 0)), 0) AS value
      FROM public.orders AS o
      WHERE o.merchant_id = p_merchant_id
        AND o.created_at >= b.start_at
        AND o.created_at < b.end_at
        AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
    ) AS bucket_revenue ON true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_mobile_admin_product_with_variants(
  p_merchant_id uuid,
  p_product_id uuid,
  p_product_payload jsonb,
  p_variants jsonb DEFAULT '[]'::jsonb,
  p_variant_model text DEFAULT 'legacy'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role text := COALESCE((SELECT auth.role()), '');
  v_has_variants boolean := COALESCE((p_product_payload->>'has_variants')::boolean, false);
  v_now timestamp with time zone := now();
  v_product_id uuid := p_product_id;
  v_result jsonb;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF p_product_payload IS NULL OR jsonb_typeof(p_product_payload) <> 'object' THEN
    RAISE EXCEPTION 'product_payload_required' USING ERRCODE = '22023';
  END IF;

  IF p_variants IS NULL OR jsonb_typeof(p_variants) <> 'array' THEN
    RAISE EXCEPTION 'variants_array_required' USING ERRCODE = '22023';
  END IF;

  IF p_variant_model NOT IN ('legacy', 'sku_matrix') THEN
    RAISE EXCEPTION 'invalid_variant_model' USING ERRCODE = '22023';
  END IF;

  IF v_caller_role <> 'service_role' AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF v_product_id IS NULL THEN
    INSERT INTO public.products (
      merchant_id,
      name,
      description,
      price,
      cost_price,
      stock_quantity,
      stock,
      sku,
      images,
      status,
      category_id,
      brand,
      fulfillment_details,
      color,
      condition,
      variant_attributes,
      has_variants,
      manage_stock,
      low_stock_threshold,
      variant_model,
      migration_status,
      updated_at
    )
    VALUES (
      p_merchant_id,
      p_product_payload->>'name',
      p_product_payload->>'description',
      (p_product_payload->>'price')::numeric,
      NULLIF(p_product_payload->>'cost_price', '')::numeric,
      COALESCE((p_product_payload->>'stock_quantity')::integer, 0),
      COALESCE((p_product_payload->>'stock')::integer, 0),
      p_product_payload->>'sku',
      COALESCE(p_product_payload->'images', '[]'::jsonb),
      COALESCE(p_product_payload->>'status', 'draft'),
      NULLIF(p_product_payload->>'category_id', '')::uuid,
      p_product_payload->>'brand',
      COALESCE(p_product_payload->'fulfillment_details', '[]'::jsonb),
      p_product_payload->>'color',
      p_product_payload->>'condition',
      COALESCE(p_product_payload->'variant_attributes', '{}'::jsonb),
      v_has_variants,
      COALESCE((p_product_payload->>'manage_stock')::boolean, true),
      NULLIF(p_product_payload->>'low_stock_threshold', '')::integer,
      p_variant_model,
      CASE WHEN p_variant_model = 'sku_matrix' THEN 'migrated' ELSE 'pending' END,
      v_now
    )
    RETURNING id INTO v_product_id;
  ELSE
    UPDATE public.products
    SET
      name = COALESCE(p_product_payload->>'name', products.name),
      description = CASE
        WHEN p_product_payload ? 'description' THEN p_product_payload->>'description'
        ELSE products.description
      END,
      price = COALESCE((p_product_payload->>'price')::numeric, products.price),
      cost_price = CASE
        WHEN p_product_payload ? 'cost_price' THEN NULLIF(p_product_payload->>'cost_price', '')::numeric
        ELSE products.cost_price
      END,
      stock_quantity = COALESCE((p_product_payload->>'stock_quantity')::integer, products.stock_quantity),
      stock = COALESCE((p_product_payload->>'stock')::integer, products.stock),
      sku = CASE
        WHEN p_product_payload ? 'sku' THEN p_product_payload->>'sku'
        ELSE products.sku
      END,
      images = CASE
        WHEN p_product_payload ? 'images' THEN COALESCE(p_product_payload->'images', '[]'::jsonb)
        ELSE products.images
      END,
      status = COALESCE(p_product_payload->>'status', products.status),
      category_id = CASE
        WHEN p_product_payload ? 'category_id' THEN NULLIF(p_product_payload->>'category_id', '')::uuid
        ELSE products.category_id
      END,
      brand = CASE
        WHEN p_product_payload ? 'brand' THEN p_product_payload->>'brand'
        ELSE products.brand
      END,
      fulfillment_details = CASE
        WHEN p_product_payload ? 'fulfillment_details' THEN COALESCE(p_product_payload->'fulfillment_details', '[]'::jsonb)
        ELSE products.fulfillment_details
      END,
      color = CASE
        WHEN p_product_payload ? 'color' THEN p_product_payload->>'color'
        ELSE products.color
      END,
      condition = CASE
        WHEN p_product_payload ? 'condition' THEN p_product_payload->>'condition'
        ELSE products.condition
      END,
      variant_attributes = CASE
        WHEN p_product_payload ? 'variant_attributes' THEN COALESCE(p_product_payload->'variant_attributes', '{}'::jsonb)
        ELSE products.variant_attributes
      END,
      has_variants = v_has_variants,
      manage_stock = COALESCE((p_product_payload->>'manage_stock')::boolean, products.manage_stock),
      low_stock_threshold = CASE
        WHEN p_product_payload ? 'low_stock_threshold' THEN NULLIF(p_product_payload->>'low_stock_threshold', '')::integer
        ELSE products.low_stock_threshold
      END,
      updated_at = v_now
    WHERE products.id = v_product_id
      AND products.merchant_id = p_merchant_id
    RETURNING products.id INTO v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product_not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF NOT v_has_variants THEN
    DELETE FROM public.product_variants AS pv
    WHERE pv.product_id = v_product_id
      AND pv.merchant_id = p_merchant_id;
  ELSE
    WITH incoming AS (
      SELECT NULLIF(variant.id, '')::uuid AS id
      FROM jsonb_to_recordset(p_variants) AS variant(id text)
      WHERE NULLIF(variant.id, '') IS NOT NULL
    )
    DELETE FROM public.product_variants AS pv
    WHERE pv.product_id = v_product_id
      AND pv.merchant_id = p_merchant_id
      AND NOT EXISTS (
        SELECT 1 FROM incoming WHERE incoming.id = pv.id
      );

    WITH incoming AS (
      SELECT
        NULLIF(variant.id, '')::uuid AS id,
        COALESCE(variant.attributes, '{}'::jsonb) AS attributes,
        variant.condition,
        variant.cost_price,
        COALESCE(variant.images, '[]'::jsonb) AS images,
        variant.price_override,
        variant.primary_image,
        variant.sku,
        COALESCE(variant.stock_quantity, 0) AS stock_quantity
      FROM jsonb_to_recordset(p_variants) AS variant(
        id text,
        attributes jsonb,
        condition text,
        cost_price numeric,
        images jsonb,
        price_override numeric,
        primary_image text,
        sku text,
        stock_quantity integer
      )
    )
    INSERT INTO public.product_variants (
      id,
      product_id,
      merchant_id,
      attributes,
      condition,
      cost_price,
      images,
      price_override,
      primary_image,
      sku,
      stock_quantity,
      updated_at
    )
    SELECT
      COALESCE(incoming.id, extensions.uuid_generate_v4()),
      v_product_id,
      p_merchant_id,
      incoming.attributes,
      incoming.condition,
      incoming.cost_price,
      incoming.images,
      incoming.price_override,
      incoming.primary_image,
      incoming.sku,
      incoming.stock_quantity,
      v_now
    FROM incoming
    ON CONFLICT (id) DO UPDATE
    SET
      attributes = EXCLUDED.attributes,
      condition = EXCLUDED.condition,
      cost_price = EXCLUDED.cost_price,
      images = EXCLUDED.images,
      price_override = EXCLUDED.price_override,
      primary_image = EXCLUDED.primary_image,
      sku = EXCLUDED.sku,
      stock_quantity = EXCLUDED.stock_quantity,
      updated_at = EXCLUDED.updated_at
    WHERE product_variants.product_id = EXCLUDED.product_id
      AND product_variants.merchant_id = EXCLUDED.merchant_id;
  END IF;

  UPDATE public.products
  SET
    variant_model = p_variant_model,
    migration_status = CASE
      WHEN p_variant_model = 'sku_matrix' THEN 'migrated'
      ELSE products.migration_status
    END,
    updated_at = v_now
  WHERE products.id = v_product_id
    AND products.merchant_id = p_merchant_id;

  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'description', p.description,
    'price', p.price,
    'compare_at_price', p.compare_at_price,
    'cost_price', p.cost_price,
    'stock_quantity', p.stock_quantity,
    'stock', p.stock,
    'sku', p.sku,
    'slug', p.slug,
    'images', COALESCE(p.images, '[]'::jsonb),
    'status', p.status,
    'category', p.category,
    'category_id', p.category_id,
    'brand', p.brand,
    'brand_id', p.brand_id,
    'fulfillment_details', p.fulfillment_details,
    'color', p.color,
    'condition', p.condition,
    'variant_attributes', p.variant_attributes,
    'has_variants', p.has_variants,
    'manage_stock', p.manage_stock,
    'low_stock_threshold', p.low_stock_threshold,
    'variant_model', p.variant_model,
    'migration_status', p.migration_status,
    'default_variant_id', p.default_variant_id,
    'available_conditions', p.available_conditions,
    'min_variant_price', p.min_variant_price,
    'max_variant_price', p.max_variant_price,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  )
  INTO v_result
  FROM public.products AS p
  WHERE p.id = v_product_id
    AND p.merchant_id = p_merchant_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mobile_admin_dashboard_stats(
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  timestamp with time zone,
  uuid
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_mobile_admin_revenue_chart(
  uuid,
  jsonb,
  uuid
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.save_mobile_admin_product_with_variants(
  uuid,
  uuid,
  jsonb,
  jsonb,
  text
) TO authenticated, service_role;
