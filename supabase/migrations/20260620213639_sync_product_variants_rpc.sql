-- Transactional, tenant-scoped variant synchronization for dashboard product edits.
-- Replaces route-level per-row REST updates so stale/cross-tenant variant IDs fail
-- before stale deletes can commit and the full variant sync remains atomic.

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
  v_invalid_variant_ids uuid[];
  v_deleted_count integer := 0;
  v_incoming_count integer := 0;
  v_upserted_count integer := 0;
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
    SELECT DISTINCT NULLIF(variant.id, '')::uuid AS id
    FROM jsonb_to_recordset(v_payload) AS variant(id text)
    WHERE NULLIF(variant.id, '') IS NOT NULL
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
  );

  IF array_length(v_invalid_variant_ids, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'variant_not_found_or_not_owned' USING ERRCODE = 'P0002';
  END IF;

  WITH incoming_ids AS (
    SELECT DISTINCT NULLIF(variant.id, '')::uuid AS id
    FROM jsonb_to_recordset(v_payload) AS variant(id text)
    WHERE NULLIF(variant.id, '') IS NOT NULL
  )
  DELETE FROM public.product_variants AS pv
  WHERE pv.product_id = p_product_id
    AND pv.merchant_id = p_merchant_id
    AND NOT EXISTS (
      SELECT 1 FROM incoming_ids WHERE incoming_ids.id = pv.id
    );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  WITH incoming AS (
    SELECT
      NULLIF(variant.id, '')::uuid AS id,
      COALESCE(variant.attributes, '{}'::jsonb) AS attributes,
      NULLIF(variant.condition, '') AS condition,
      variant.cost_price,
      COALESCE(variant.images, '[]'::jsonb) AS images,
      variant.price_override,
      NULLIF(variant.primary_image, '') AS primary_image,
      NULLIF(variant.sku, '') AS sku,
      COALESCE(variant.stock_quantity, 0) AS stock_quantity
    FROM jsonb_to_recordset(v_payload) AS variant(
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
    now()
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
  WHERE product_variants.product_id = p_product_id
    AND product_variants.merchant_id = p_merchant_id;

  GET DIAGNOSTICS v_upserted_count = ROW_COUNT;

  IF v_upserted_count <> v_incoming_count THEN
    RAISE EXCEPTION 'variant_sync_conflict' USING ERRCODE = '40001';
  END IF;

  RETURN v_deleted_count + v_upserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_product_variants_for_product(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_product_variants_for_product(uuid, uuid, jsonb)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.sync_product_variants_for_product(uuid, uuid, jsonb) IS
  'Atomically syncs a merchant-owned product variant set. Existing variant IDs must already belong to the same product and merchant before stale variants are deleted or new variants are inserted.';
