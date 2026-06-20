-- Transactional, tenant-scoped variant synchronization for dashboard product edits.
-- Replaces route-level per-row REST updates so stale/cross-tenant variant IDs fail
-- before stale deletes can commit and the full visible-variant sync remains atomic.

CREATE OR REPLACE FUNCTION public.sync_product_variants_for_product(
  p_product_id uuid,
  p_merchant_id uuid,
  p_variants jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_payload jsonb := COALESCE(p_variants, '[]'::jsonb);
  v_duplicate_variant_ids uuid[];
  v_invalid_variant_ids uuid[];
  v_deleted_count integer := 0;
  v_inserted_count integer := 0;
  v_incoming_count integer := 0;
  v_updated_count integer := 0;
BEGIN
  IF p_product_id IS NULL OR p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'product_and_merchant_required' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_payload) <> 'array' THEN
    RAISE EXCEPTION 'variants_payload_must_be_array' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products AS p
    WHERE p.id = p_product_id
      AND p.merchant_id = p_merchant_id
  ) THEN
    RAISE EXCEPTION 'product_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_incoming_count := jsonb_array_length(v_payload);

  WITH incoming_ids AS (
    SELECT NULLIF(element.raw->>'id', '')::uuid AS id
    FROM jsonb_array_elements(v_payload) AS element(raw)
    WHERE NULLIF(element.raw->>'id', '') IS NOT NULL
  ), duplicate_ids AS (
    SELECT incoming_ids.id
    FROM incoming_ids
    GROUP BY incoming_ids.id
    HAVING count(*) > 1
  )
  SELECT array_agg(duplicate_ids.id ORDER BY duplicate_ids.id)
  INTO v_duplicate_variant_ids
  FROM duplicate_ids;

  IF array_length(v_duplicate_variant_ids, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'duplicate_variant_ids' USING ERRCODE = '22023';
  END IF;

  WITH incoming_ids AS (
    SELECT NULLIF(element.raw->>'id', '')::uuid AS id
    FROM jsonb_array_elements(v_payload) AS element(raw)
    WHERE NULLIF(element.raw->>'id', '') IS NOT NULL
  )
  SELECT array_agg(incoming_ids.id ORDER BY incoming_ids.id)
  INTO v_invalid_variant_ids
  FROM incoming_ids
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.product_variants AS pv
    WHERE pv.id = incoming_ids.id
      AND pv.product_id = p_product_id
      AND pv.merchant_id = p_merchant_id
      AND pv.is_inventory_anchor = false
  );

  IF array_length(v_invalid_variant_ids, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'variant_not_found_or_not_owned' USING ERRCODE = 'P0002';
  END IF;

  WITH incoming_ids AS (
    SELECT NULLIF(element.raw->>'id', '')::uuid AS id
    FROM jsonb_array_elements(v_payload) AS element(raw)
    WHERE NULLIF(element.raw->>'id', '') IS NOT NULL
  )
  DELETE FROM public.product_variants AS pv
  WHERE pv.product_id = p_product_id
    AND pv.merchant_id = p_merchant_id
    AND pv.is_inventory_anchor = false
    AND NOT EXISTS (
      SELECT 1 FROM incoming_ids WHERE incoming_ids.id = pv.id
    );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  WITH incoming AS (
    SELECT
      NULLIF(element.raw->>'id', '')::uuid AS id,
      element.raw ? 'attributes' AS has_attributes,
      CASE
        WHEN element.raw ? 'attributes'
          AND jsonb_typeof(element.raw->'attributes') = 'object'
        THEN element.raw->'attributes'
        ELSE '{}'::jsonb
      END AS attributes,
      element.raw ? 'condition' AS has_condition,
      NULLIF(element.raw->>'condition', '') AS condition,
      element.raw ? 'cost_price' AS has_cost_price,
      NULLIF(element.raw->>'cost_price', '')::numeric AS cost_price,
      element.raw ? 'images' AS has_images,
      CASE
        WHEN element.raw ? 'images'
          AND jsonb_typeof(element.raw->'images') = 'array'
        THEN element.raw->'images'
        ELSE '[]'::jsonb
      END AS images,
      element.raw ? 'price_override' AS has_price_override,
      NULLIF(element.raw->>'price_override', '')::numeric AS price_override,
      element.raw ? 'primary_image' AS has_primary_image,
      NULLIF(element.raw->>'primary_image', '') AS primary_image,
      element.raw ? 'sku' AS has_sku,
      NULLIF(element.raw->>'sku', '') AS sku,
      element.raw ? 'stock_quantity' AS has_stock_quantity,
      COALESCE(NULLIF(element.raw->>'stock_quantity', '')::integer, 0) AS stock_quantity
    FROM jsonb_array_elements(v_payload) AS element(raw)
  )
  UPDATE public.product_variants AS pv
  SET
    attributes = CASE WHEN incoming.has_attributes THEN incoming.attributes ELSE pv.attributes END,
    condition = CASE WHEN incoming.has_condition THEN incoming.condition ELSE pv.condition END,
    cost_price = CASE WHEN incoming.has_cost_price THEN incoming.cost_price ELSE pv.cost_price END,
    images = CASE WHEN incoming.has_images THEN incoming.images ELSE pv.images END,
    price_override = CASE WHEN incoming.has_price_override THEN incoming.price_override ELSE pv.price_override END,
    primary_image = CASE WHEN incoming.has_primary_image THEN incoming.primary_image ELSE pv.primary_image END,
    sku = CASE WHEN incoming.has_sku THEN incoming.sku ELSE pv.sku END,
    stock_quantity = CASE WHEN incoming.has_stock_quantity THEN incoming.stock_quantity ELSE pv.stock_quantity END,
    updated_at = now()
  FROM incoming
  WHERE incoming.id IS NOT NULL
    AND pv.id = incoming.id
    AND pv.product_id = p_product_id
    AND pv.merchant_id = p_merchant_id
    AND pv.is_inventory_anchor = false;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  WITH incoming AS (
    SELECT
      NULLIF(element.raw->>'id', '')::uuid AS id,
      CASE
        WHEN element.raw ? 'attributes'
          AND jsonb_typeof(element.raw->'attributes') = 'object'
        THEN element.raw->'attributes'
        ELSE '{}'::jsonb
      END AS attributes,
      NULLIF(element.raw->>'condition', '') AS condition,
      NULLIF(element.raw->>'cost_price', '')::numeric AS cost_price,
      CASE
        WHEN element.raw ? 'images'
          AND jsonb_typeof(element.raw->'images') = 'array'
        THEN element.raw->'images'
        ELSE '[]'::jsonb
      END AS images,
      NULLIF(element.raw->>'price_override', '')::numeric AS price_override,
      NULLIF(element.raw->>'primary_image', '') AS primary_image,
      NULLIF(element.raw->>'sku', '') AS sku,
      COALESCE(NULLIF(element.raw->>'stock_quantity', '')::integer, 0) AS stock_quantity
    FROM jsonb_array_elements(v_payload) AS element(raw)
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
    is_inventory_anchor,
    updated_at
  )
  SELECT
    extensions.uuid_generate_v4(),
    p_product_id,
    p_merchant_id,
    incoming.attributes,
    incoming.condition,
    incoming.cost_price,
    incoming.images,
    incoming.price_override,
    incoming.primary_image,
    incoming.sku,
    incoming.stock_quantity,
    false,
    now()
  FROM incoming
  WHERE incoming.id IS NULL;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  IF (v_updated_count + v_inserted_count) <> v_incoming_count THEN
    RAISE EXCEPTION 'variant_sync_conflict' USING ERRCODE = '40001';
  END IF;

  RETURN v_deleted_count + v_updated_count + v_inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_product_variants_for_product(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_product_variants_for_product(uuid, uuid, jsonb)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.sync_product_variants_for_product(uuid, uuid, jsonb) IS
  'Atomically syncs a merchant-owned visible product variant set while preserving hidden inventory anchors. Existing visible variant IDs must already belong to the same product and merchant before stale visible variants are deleted or new variants are inserted. Omitted fields on existing variants preserve their stored values.';
