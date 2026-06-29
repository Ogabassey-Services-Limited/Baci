DROP FUNCTION IF EXISTS public.save_mobile_admin_product_with_variants(
  uuid,
  uuid,
  jsonb,
  jsonb,
  text
);

CREATE OR REPLACE FUNCTION public.save_mobile_admin_product_with_variants(
  p_merchant_id uuid,
  p_product_id uuid,
  p_product_payload jsonb,
  p_variants jsonb DEFAULT '[]'::jsonb,
  p_variant_model text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product_id uuid := COALESCE(p_product_id, gen_random_uuid());
  v_variant_model text := COALESCE(
    NULLIF(p_variant_model, ''),
    p_product_payload->>'variant_model',
    'legacy'
  );
  v_product_payload jsonb := jsonb_set(
    COALESCE(p_product_payload, '{}'::jsonb),
    '{variant_model}',
    to_jsonb(v_variant_model),
    true
  );
  v_existing_inventory_tracking_policy text;
  v_updated_product_id uuid;
  v_result jsonb;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role'
     AND public.has_merchant_access(p_merchant_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden_save_mobile_admin_product_with_variants' USING ERRCODE = '42501';
  END IF;

  IF p_product_payload IS NULL OR jsonb_typeof(p_product_payload) <> 'object' THEN
    RAISE EXCEPTION 'product_payload_required' USING ERRCODE = '22023';
  END IF;

  IF p_variants IS NULL OR jsonb_typeof(p_variants) <> 'array' THEN
    RAISE EXCEPTION 'variants_array_required' USING ERRCODE = '22023';
  END IF;

  IF v_variant_model NOT IN ('legacy', 'sku_matrix') THEN
    RAISE EXCEPTION 'invalid_variant_model' USING ERRCODE = '22023';
  END IF;

  IF p_product_id IS NULL THEN
    PERFORM private.enforce_mobile_admin_product_limit(p_merchant_id, v_product_id);
  ELSE
    SELECT p.inventory_tracking_policy
    INTO v_existing_inventory_tracking_policy
    FROM public.products AS p
    WHERE p.id = p_product_id
      AND p.merchant_id = p_merchant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product_not_found' USING ERRCODE = 'P0002';
    END IF;

    IF NOT (v_product_payload ? 'inventory_tracking_policy') THEN
      v_product_payload := jsonb_set(
        v_product_payload,
        '{inventory_tracking_policy}',
        to_jsonb(v_existing_inventory_tracking_policy),
        true
      );
    END IF;
  END IF;

  PERFORM private.save_mobile_admin_product_with_variants(
    p_merchant_id,
    v_product_id,
    v_product_payload,
    p_variants,
    NULL
  );

  UPDATE public.products
  SET
    fulfillment_details = CASE
      WHEN v_product_payload ? 'fulfillment_details' THEN COALESCE(v_product_payload->'fulfillment_details', '[]'::jsonb)
      ELSE products.fulfillment_details
    END,
    color = CASE
      WHEN v_product_payload ? 'color' THEN v_product_payload->>'color'
      ELSE products.color
    END,
    condition = CASE
      WHEN v_product_payload ? 'condition' THEN v_product_payload->>'condition'
      ELSE products.condition
    END,
    variant_attributes = CASE
      WHEN v_product_payload ? 'variant_attributes' THEN COALESCE(v_product_payload->'variant_attributes', '{}'::jsonb)
      ELSE products.variant_attributes
    END,
    low_stock_threshold = CASE
      WHEN v_product_payload ? 'low_stock_threshold' THEN NULLIF(v_product_payload->>'low_stock_threshold', '')::integer
      ELSE products.low_stock_threshold
    END,
    migration_status = CASE
      WHEN v_variant_model = 'sku_matrix' THEN 'migrated'
      ELSE products.migration_status
    END,
    updated_at = now()
  WHERE products.id = v_product_id
    AND products.merchant_id = p_merchant_id
  RETURNING products.id INTO v_updated_product_id;

  IF v_updated_product_id IS NULL THEN
    RAISE EXCEPTION 'product_not_found' USING ERRCODE = 'P0002';
  END IF;

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
    'inventory_tracking_policy', p.inventory_tracking_policy,
    'inventory_anchor_variant_id', p.inventory_anchor_variant_id,
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

REVOKE ALL ON FUNCTION public.save_mobile_admin_product_with_variants(
  uuid,
  uuid,
  jsonb,
  jsonb,
  text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_mobile_admin_product_with_variants(
  uuid,
  uuid,
  jsonb,
  jsonb,
  text
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
