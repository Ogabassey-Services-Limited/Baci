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
  v_has_variants boolean;
  v_existing_has_variants boolean;
  v_existing_inventory_tracking_policy text;
  v_existing_anchor_id uuid;
  v_inventory_tracking_policy text;
  v_reassign_anchor_to_variant_id uuid;
  v_reassign_anchor_variant jsonb;
  v_variants_for_sync jsonb := '[]'::jsonb;
  v_moved_inventory_unit_id uuid;
  v_updated_product_id uuid;
  v_synced_variant_count integer;
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
    v_has_variants := COALESCE(NULLIF(v_product_payload->>'has_variants', '')::boolean, false);

    PERFORM private.enforce_mobile_admin_product_limit(p_merchant_id, v_product_id);
    v_inventory_tracking_policy := COALESCE(
      NULLIF(v_product_payload->>'inventory_tracking_policy', ''),
      'off'
    );
  ELSE
    SELECT p.has_variants, p.inventory_tracking_policy, p.inventory_anchor_variant_id
    INTO v_existing_has_variants, v_existing_inventory_tracking_policy, v_existing_anchor_id
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

    v_has_variants := CASE
      WHEN v_product_payload ? 'has_variants' THEN COALESCE(NULLIF(v_product_payload->>'has_variants', '')::boolean, false)
      ELSE COALESCE(v_existing_has_variants, false)
    END;

    v_inventory_tracking_policy := COALESCE(
      NULLIF(v_product_payload->>'inventory_tracking_policy', ''),
      v_existing_inventory_tracking_policy,
      'off'
    );
  END IF;

  IF v_inventory_tracking_policy NOT IN ('off', 'serialized_strict', 'serialized_then_unlimited') THEN
    RAISE EXCEPTION 'invalid_inventory_tracking_policy' USING ERRCODE = '22023';
  END IF;

  IF v_inventory_tracking_policy IN ('serialized_strict', 'serialized_then_unlimited')
     AND EXISTS (
       SELECT 1
       FROM public.product_offers
       WHERE product_id = v_product_id
     ) THEN
    RAISE EXCEPTION 'legacy_product_offers_must_be_migrated' USING ERRCODE = '23514';
  END IF;

  v_variants_for_sync := CASE
    WHEN v_has_variants IS TRUE THEN p_variants
    ELSE '[]'::jsonb
  END;

  IF p_product_id IS NULL AND v_has_variants IS TRUE THEN
    SELECT COALESCE(jsonb_agg(element.raw - 'id' ORDER BY element.ordinal), '[]'::jsonb)
    INTO v_variants_for_sync
    FROM jsonb_array_elements(p_variants) WITH ORDINALITY AS element(raw, ordinal);
  END IF;

  IF p_product_id IS NOT NULL
     AND v_has_variants IS TRUE
     AND v_existing_anchor_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.variant_inventory
      WHERE variant_id = v_existing_anchor_id
    ) THEN
      v_reassign_anchor_to_variant_id := NULLIF(
        v_product_payload->>'reassign_anchor_to_variant_id',
        ''
      )::uuid;

      IF v_reassign_anchor_to_variant_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1
          FROM public.product_variants
          WHERE id = v_reassign_anchor_to_variant_id
            AND (
              product_id IS DISTINCT FROM v_product_id
              OR merchant_id IS DISTINCT FROM p_merchant_id
              OR is_inventory_anchor IS DISTINCT FROM false
            )
        ) THEN
          RAISE EXCEPTION 'serialized_inventory_reassignment_required' USING ERRCODE = '23514';
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM public.product_variants
          WHERE id = v_reassign_anchor_to_variant_id
            AND product_id = v_product_id
            AND merchant_id = p_merchant_id
            AND is_inventory_anchor = false
        ) THEN
          SELECT element.raw
          INTO v_reassign_anchor_variant
          FROM jsonb_array_elements(p_variants) AS element(raw)
          WHERE NULLIF(element.raw->>'id', '') = v_reassign_anchor_to_variant_id::text
          LIMIT 1;

          IF v_reassign_anchor_variant IS NULL THEN
            RAISE EXCEPTION 'serialized_inventory_reassignment_required' USING ERRCODE = '23514';
          END IF;

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
          ) VALUES (
            v_reassign_anchor_to_variant_id,
            v_product_id,
            p_merchant_id,
            CASE
              WHEN v_reassign_anchor_variant ? 'attributes'
                AND jsonb_typeof(v_reassign_anchor_variant->'attributes') = 'object'
              THEN v_reassign_anchor_variant->'attributes'
              ELSE '{}'::jsonb
            END,
            NULLIF(v_reassign_anchor_variant->>'condition', ''),
            NULLIF(v_reassign_anchor_variant->>'cost_price', '')::numeric,
            CASE
              WHEN v_reassign_anchor_variant ? 'images'
                AND jsonb_typeof(v_reassign_anchor_variant->'images') = 'array'
              THEN v_reassign_anchor_variant->'images'
              ELSE '[]'::jsonb
            END,
            NULLIF(v_reassign_anchor_variant->>'price_override', '')::numeric,
            NULLIF(v_reassign_anchor_variant->>'primary_image', ''),
            NULLIF(v_reassign_anchor_variant->>'sku', ''),
            COALESCE(NULLIF(v_reassign_anchor_variant->>'stock_quantity', '')::integer, 0),
            false,
            now()
          );
        END IF;
      END IF;
    END IF;

    UPDATE public.products
    SET inventory_anchor_variant_id = NULL,
        updated_at = now()
    WHERE id = v_product_id
      AND merchant_id = p_merchant_id;
  END IF;

  IF p_product_id IS NULL THEN
    INSERT INTO public.products (
      id,
      merchant_id,
      name,
      description,
      price,
      compare_at_price,
      cost_price,
      stock_quantity,
      stock,
      sku,
      slug,
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
      inventory_tracking_policy,
      updated_at
    ) VALUES (
      v_product_id,
      p_merchant_id,
      v_product_payload->>'name',
      v_product_payload->>'description',
      NULLIF(v_product_payload->>'price', '')::numeric,
      NULLIF(v_product_payload->>'compare_at_price', '')::numeric,
      NULLIF(v_product_payload->>'cost_price', '')::numeric,
      CASE
        WHEN v_has_variants IS TRUE THEN 0
        WHEN v_product_payload ? 'stock_quantity' THEN NULLIF(v_product_payload->>'stock_quantity', '')::integer
        ELSE 0
      END,
      CASE
        WHEN v_has_variants IS TRUE THEN 0
        WHEN v_product_payload ? 'stock' THEN NULLIF(v_product_payload->>'stock', '')::integer
        WHEN v_product_payload ? 'stock_quantity' THEN NULLIF(v_product_payload->>'stock_quantity', '')::integer
        ELSE 0
      END,
      v_product_payload->>'sku',
      NULLIF(v_product_payload->>'slug', ''),
      COALESCE(v_product_payload->'images', '[]'::jsonb),
      COALESCE(NULLIF(v_product_payload->>'status', ''), 'draft'),
      NULLIF(v_product_payload->>'category_id', '')::uuid,
      v_product_payload->>'brand',
      COALESCE(v_product_payload->'fulfillment_details', '[]'::jsonb),
      v_product_payload->>'color',
      v_product_payload->>'condition',
      COALESCE(v_product_payload->'variant_attributes', '{}'::jsonb),
      v_has_variants,
      COALESCE(NULLIF(v_product_payload->>'manage_stock', '')::boolean, true),
      NULLIF(v_product_payload->>'low_stock_threshold', '')::integer,
      v_variant_model,
      CASE WHEN v_variant_model = 'sku_matrix' THEN 'migrated' ELSE 'pending' END,
      v_inventory_tracking_policy,
      now()
    )
    RETURNING id INTO v_updated_product_id;
  ELSE
    UPDATE public.products
    SET
      name = CASE
        WHEN v_product_payload ? 'name' THEN v_product_payload->>'name'
        ELSE products.name
      END,
      description = CASE
        WHEN v_product_payload ? 'description' THEN v_product_payload->>'description'
        ELSE products.description
      END,
      price = CASE
        WHEN v_product_payload ? 'price' THEN NULLIF(v_product_payload->>'price', '')::numeric
        ELSE products.price
      END,
      compare_at_price = CASE
        WHEN v_product_payload ? 'compare_at_price' THEN NULLIF(v_product_payload->>'compare_at_price', '')::numeric
        ELSE products.compare_at_price
      END,
      cost_price = CASE
        WHEN v_product_payload ? 'cost_price' THEN NULLIF(v_product_payload->>'cost_price', '')::numeric
        ELSE products.cost_price
      END,
      stock_quantity = CASE
        WHEN v_has_variants IS TRUE THEN products.stock_quantity
        WHEN v_product_payload ? 'stock_quantity' THEN NULLIF(v_product_payload->>'stock_quantity', '')::integer
        ELSE products.stock_quantity
      END,
      stock = CASE
        WHEN v_has_variants IS TRUE THEN products.stock
        WHEN v_product_payload ? 'stock' THEN NULLIF(v_product_payload->>'stock', '')::integer
        WHEN v_product_payload ? 'stock_quantity' THEN NULLIF(v_product_payload->>'stock_quantity', '')::integer
        ELSE products.stock
      END,
      sku = CASE
        WHEN v_product_payload ? 'sku' THEN v_product_payload->>'sku'
        ELSE products.sku
      END,
      slug = CASE
        WHEN v_product_payload ? 'slug' THEN NULLIF(v_product_payload->>'slug', '')
        ELSE products.slug
      END,
      images = CASE
        WHEN v_product_payload ? 'images' THEN COALESCE(v_product_payload->'images', '[]'::jsonb)
        ELSE products.images
      END,
      status = CASE
        WHEN v_product_payload ? 'status' THEN COALESCE(NULLIF(v_product_payload->>'status', ''), products.status)
        ELSE products.status
      END,
      category_id = CASE
        WHEN v_product_payload ? 'category_id' THEN NULLIF(v_product_payload->>'category_id', '')::uuid
        ELSE products.category_id
      END,
      brand = CASE
        WHEN v_product_payload ? 'brand' THEN v_product_payload->>'brand'
        ELSE products.brand
      END,
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
      has_variants = CASE
        WHEN v_product_payload ? 'has_variants' THEN v_has_variants
        ELSE products.has_variants
      END,
      manage_stock = CASE
        WHEN v_product_payload ? 'manage_stock' THEN NULLIF(v_product_payload->>'manage_stock', '')::boolean
        ELSE products.manage_stock
      END,
      low_stock_threshold = CASE
        WHEN v_product_payload ? 'low_stock_threshold' THEN NULLIF(v_product_payload->>'low_stock_threshold', '')::integer
        ELSE products.low_stock_threshold
      END,
      variant_model = v_variant_model,
      migration_status = CASE
        WHEN v_variant_model = 'sku_matrix' THEN 'migrated'
        ELSE products.migration_status
      END,
      inventory_tracking_policy = v_inventory_tracking_policy,
      updated_at = now()
    WHERE products.id = v_product_id
      AND products.merchant_id = p_merchant_id
    RETURNING products.id INTO v_updated_product_id;
  END IF;

  IF p_product_id IS NULL OR v_product_payload ? 'has_variants' THEN
    v_synced_variant_count := public.sync_product_variants_for_product(
      v_product_id,
      p_merchant_id,
      v_variants_for_sync
    );
  END IF;

  IF p_product_id IS NOT NULL
     AND v_has_variants IS TRUE
     AND v_existing_anchor_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.variant_inventory
      WHERE variant_id = v_existing_anchor_id
    ) THEN
      IF v_reassign_anchor_to_variant_id IS NULL THEN
        v_reassign_anchor_to_variant_id := NULLIF(
          v_product_payload->>'reassign_anchor_to_variant_id',
          ''
        )::uuid;
      END IF;

      IF v_reassign_anchor_to_variant_id IS NULL THEN
        SELECT pv.id
        INTO v_reassign_anchor_to_variant_id
        FROM public.product_variants AS pv
        WHERE pv.product_id = v_product_id
          AND pv.merchant_id = p_merchant_id
          AND pv.is_inventory_anchor = false
        ORDER BY pv.created_at NULLS LAST, pv.id
        LIMIT 1;
      END IF;

      IF v_reassign_anchor_to_variant_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.product_variants
        WHERE id = v_reassign_anchor_to_variant_id
          AND product_id = v_product_id
          AND merchant_id = p_merchant_id
          AND is_inventory_anchor = false
      ) THEN
        RAISE EXCEPTION 'serialized_inventory_reassignment_required' USING ERRCODE = '23514';
      END IF;

      PERFORM 1
      FROM public.variant_inventory
      WHERE variant_id = v_existing_anchor_id
      FOR UPDATE;

      IF EXISTS (
        SELECT 1
        FROM public.variant_inventory
        WHERE variant_id = v_existing_anchor_id
          AND status = 'reserved'
      ) THEN
        RAISE EXCEPTION 'serialized_inventory_reserved_units_exist' USING ERRCODE = '23514';
      END IF;

      FOR v_moved_inventory_unit_id IN
        UPDATE public.variant_inventory
        SET variant_id = v_reassign_anchor_to_variant_id,
            updated_at = now()
        WHERE variant_id = v_existing_anchor_id
        RETURNING id
      LOOP
        PERFORM private.record_variant_inventory_event(
          v_moved_inventory_unit_id,
          p_merchant_id,
          v_product_id,
          v_reassign_anchor_to_variant_id,
          'branch_transferred',
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          auth.uid(),
          'mobile_admin',
          jsonb_build_object('anchorReassignedFrom', v_existing_anchor_id)
        );
      END LOOP;
    END IF;

    DELETE FROM public.product_variants
    WHERE id = v_existing_anchor_id
      AND product_id = v_product_id
      AND merchant_id = p_merchant_id
      AND is_inventory_anchor = true;
  END IF;

  IF v_has_variants IS NOT TRUE
     AND v_inventory_tracking_policy IN ('serialized_strict', 'serialized_then_unlimited') THEN
    PERFORM private.ensure_product_inventory_anchor_variant(p_merchant_id, v_product_id);
  END IF;

  PERFORM private.sync_serialized_stock(p_merchant_id, v_product_id);

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
