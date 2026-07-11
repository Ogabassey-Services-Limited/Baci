-- Establish bounded, public-safe storefront read models for the merchant shell
-- and PDP critical path. This migration also closes the active-domain
-- normalization gap that previously let duplicate rows turn a live store into
-- a cached not-found result.

CREATE OR REPLACE FUNCTION private.normalize_storefront_domain_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  NEW.domain := pg_catalog.lower(pg_catalog.btrim(NEW.domain));

  IF NEW.domain = '' THEN
    RAISE EXCEPTION 'storefront_domain_must_not_be_blank'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_storefront_domain_row ON public.domains;
CREATE TRIGGER normalize_storefront_domain_row
BEFORE INSERT OR UPDATE OF domain ON public.domains
FOR EACH ROW
EXECUTE FUNCTION private.normalize_storefront_domain_row();

-- All current duplicate normalized domains belong to the same merchant. Keep
-- the primary/newest deterministic winner and remove only redundant rows. The
-- domains table has no inbound foreign keys, so this does not orphan data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.domains AS domain_row
    WHERE domain_row.status = 'active'
    GROUP BY pg_catalog.lower(pg_catalog.btrim(domain_row.domain))
    HAVING pg_catalog.count(DISTINCT domain_row.merchant_id) > 1
  ) THEN
    RAISE EXCEPTION 'ambiguous_active_storefront_domain'
      USING ERRCODE = '23505';
  END IF;
END;
$$;

WITH ranked_active_domains AS (
  SELECT
    domain_row.id,
    pg_catalog.row_number() OVER (
      PARTITION BY
        domain_row.merchant_id,
        pg_catalog.lower(pg_catalog.btrim(domain_row.domain))
      ORDER BY
        COALESCE(domain_row.is_primary, false) DESC,
        domain_row.updated_at DESC NULLS LAST,
        domain_row.created_at DESC NULLS LAST,
        domain_row.id
    ) AS duplicate_rank
  FROM public.domains AS domain_row
  WHERE domain_row.status = 'active'
)
DELETE FROM public.domains AS domain_row
USING ranked_active_domains AS ranked
WHERE domain_row.id = ranked.id
  AND ranked.duplicate_rank > 1;

UPDATE public.domains AS domain_row
SET domain = pg_catalog.lower(pg_catalog.btrim(domain_row.domain))
WHERE domain_row.domain IS DISTINCT FROM
  pg_catalog.lower(pg_catalog.btrim(domain_row.domain));

CREATE UNIQUE INDEX IF NOT EXISTS domains_active_normalized_domain_uidx
ON public.domains (
  pg_catalog.lower(pg_catalog.btrim(domain))
)
WHERE status = 'active';

-- Existing public resolvers still predicate on lower(domain). PostgreSQL only
-- uses an expression index when the indexed expression matches the predicate,
-- so retain this read index until every resolver moves to the normalized form.
CREATE INDEX IF NOT EXISTS idx_domains_active_lower_domain
ON public.domains (pg_catalog.lower(domain))
WHERE status = 'active';

-- The broad resolver remains service-role-only. This public wrapper executes
-- with its owner's rights, exposes an explicit result status, and collapses an
-- unpublished merchant to the shell identity fields and publication flag
-- needed by the coming-soon page. Draft content, feature settings, payment,
-- and plan data never cross the anonymous RPC boundary.
CREATE OR REPLACE FUNCTION public.resolve_storefront_public_snapshot_v2(
  p_identifier text
)
RETURNS TABLE (
  resolution_status text,
  merchant_data jsonb,
  custom_domain text,
  feature_settings jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
ROWS 1
AS $$
  WITH resolved AS MATERIALIZED (
    SELECT
      merchant_row.merchant_data,
      merchant_row.custom_domain,
      (
        COALESCE(
          CASE
            WHEN merchant_row.feature_settings IS NULL THEN NULL::jsonb
            ELSE (
              merchant_row.feature_settings - 'custom_settings'
              || pg_catalog.jsonb_build_object(
                'custom_settings',
                pg_catalog.jsonb_strip_nulls(
                  pg_catalog.jsonb_build_object(
                    'google_merchant_id',
                      merchant_row.feature_settings->'custom_settings'->'google_merchant_id',
                    'google_store_widget_enabled',
                      merchant_row.feature_settings->'custom_settings'->'google_store_widget_enabled'
                  )
                )
              )
            )
          END,
          '{}'::jsonb
        )
        || pg_catalog.jsonb_build_object(
          'paystack_subaccount_configured',
            NULLIF(
              pg_catalog.btrim(
                merchant_row.merchant_data->>'paystack_subaccount_code'
              ),
              ''
            ) IS NOT NULL,
          'price_negotiation_enabled',
            CASE
              WHEN merchant_row.merchant_data->>'plan_tier' IN (
                'pro',
                'business',
                'enterprise'
              ) THEN true
              WHEN merchant_row.merchant_data->>'plan_tier' IS NOT NULL
                THEN false
              ELSE pg_catalog.lower(
                merchant_row.merchant_data->>'slug'
              ) IN ('ogabassey', 'demo-premium')
            END
        )
      ) AS feature_settings,
      COALESCE(
        (merchant_row.merchant_data->>'is_published')::boolean,
        false
      ) AS is_published
    FROM public.resolve_storefront_cached_merchant(
      pg_catalog.lower(pg_catalog.btrim(p_identifier))
    ) AS merchant_row
  ),
  public_projection AS MATERIALIZED (
    SELECT
      CASE
        WHEN resolved.is_published THEN pg_catalog.jsonb_build_object(
          'id', resolved.merchant_data->'id',
          'business_name', resolved.merchant_data->'business_name',
          'site_title', resolved.merchant_data->'site_title',
          'site_tagline', resolved.merchant_data->'site_tagline',
          'site_description', resolved.merchant_data->'site_description',
          'business_type', resolved.merchant_data->'business_type',
          'logo_url', resolved.merchant_data->'logo_url',
          'phone', resolved.merchant_data->'phone',
          'email', resolved.merchant_data->'email',
          'support_email', resolved.merchant_data->'support_email',
          'support_phone', resolved.merchant_data->'support_phone',
          'social_media', resolved.merchant_data->'social_media',
          'brand_colors', resolved.merchant_data->'brand_colors',
          'slug', resolved.merchant_data->'slug',
          'business_address', resolved.merchant_data->'business_address',
          'legal_entity_name', resolved.merchant_data->'legal_entity_name',
          'registered_address', resolved.merchant_data->'registered_address',
          'tax_identification_number',
            resolved.merchant_data->'tax_identification_number',
          'trust_profile', resolved.merchant_data->'trust_profile',
          'payout_currency', resolved.merchant_data->'payout_currency',
          'is_published', resolved.merchant_data->'is_published',
          'template_id', resolved.merchant_data->'template_id',
          'country', resolved.merchant_data->'country',
          'hero_slides', resolved.merchant_data->'hero_slides',
          'mobile_hero_slides', resolved.merchant_data->'mobile_hero_slides',
          'favicon_svg_url', resolved.merchant_data->'favicon_svg_url',
          'favicon_png_32_url', resolved.merchant_data->'favicon_png_32_url',
          'favicon_apple_touch_url',
            resolved.merchant_data->'favicon_apple_touch_url',
          'vat_registration_status',
            resolved.merchant_data->'vat_registration_status',
          'vat_rate', resolved.merchant_data->'vat_rate',
          'published_config', resolved.merchant_data->'published_config',
          'pages', resolved.merchant_data->'pages',
          'about_page', resolved.merchant_data->'about_page',
          'faq_items', resolved.merchant_data->'faq_items',
          'updated_at', resolved.merchant_data->'updated_at'
        )
        ELSE pg_catalog.jsonb_build_object(
          'id', resolved.merchant_data->'id',
          'business_name', resolved.merchant_data->'business_name',
          'slug', resolved.merchant_data->'slug',
          'is_published', false
        )
      END AS merchant_data,
      CASE WHEN resolved.is_published THEN resolved.custom_domain
        ELSE NULL::text
      END AS custom_domain,
      CASE WHEN resolved.is_published THEN resolved.feature_settings
        ELSE NULL::jsonb
      END AS feature_settings
    FROM resolved
  )
  SELECT
    'found'::text,
    public_projection.merchant_data,
    pg_catalog.lower(pg_catalog.btrim(public_projection.custom_domain)),
    public_projection.feature_settings
  FROM public_projection

  UNION ALL

  SELECT
    'not_found'::text,
    NULL::jsonb,
    NULL::text,
    NULL::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM public_projection);
$$;

REVOKE ALL ON FUNCTION public.resolve_storefront_cached_merchant(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_storefront_cached_merchant(text)
  TO service_role;

REVOKE ALL ON FUNCTION public.resolve_storefront_public_snapshot_v2(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_storefront_public_snapshot_v2(text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.resolve_storefront_public_snapshot_v2(text) IS
  'Bounded public merchant-shell snapshot with explicit found/not_found status and unpublished-store data minimization.';

CREATE OR REPLACE FUNCTION private.get_storefront_pdp_core_v2(
  p_merchant_id uuid,
  p_product_slug text,
  p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE (
  resolution_status text,
  product_data jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH normalized_input AS (
    SELECT
      pg_catalog.lower(pg_catalog.btrim(p_product_slug)) AS product_identifier,
      CASE
        WHEN pg_catalog.lower(pg_catalog.btrim(p_product_slug)) ~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN pg_catalog.lower(pg_catalog.btrim(p_product_slug))::uuid
        ELSE NULL::uuid
      END AS product_id
    WHERE p_merchant_id IS NOT NULL
      AND p_product_slug IS NOT NULL
      AND pg_catalog.octet_length(p_product_slug) <= 200
      AND pg_catalog.btrim(p_product_slug) <> ''
  ),
  selected_product AS MATERIALIZED (
    SELECT
      product_row.id,
      product_row.merchant_id,
      product_row.category_id,
      product_row.created_at,
      product_row.updated_at,
      product_row.name,
      product_row.description,
      product_row.status,
      product_row.price,
      product_row.compare_at_price,
      product_row.stock,
      product_row.stock_quantity,
      product_row.manage_stock,
      product_row.low_stock_threshold,
      product_row.sku,
      product_row.slug,
      product_row.condition,
      product_row.condition_detail,
      product_row.variant_model,
      product_row.default_variant_id,
      product_row.available_conditions,
      product_row.min_variant_price,
      product_row.max_variant_price,
      product_row.brand,
      product_row.category,
      product_row.color,
      product_row.has_variants,
      product_row.has_condition_offers,
      product_row.variant_attributes,
      product_row.images,
      product_row.image_hint,
      product_row.specifications,
      product_row.weight_value,
      product_row.weight_unit,
      product_row.dimensions,
      product_row.taxable,
      product_row.tax_code,
      product_row.meta_title,
      product_row.meta_description,
      product_row.keywords,
      product_row.canonical_url,
      product_row.schema_markup,
      product_row.gtin,
      product_row.mpn,
      product_row.google_product_category,
      product_row.fulfillment_fields,
      product_row.inventory_tracking_policy
    FROM normalized_input AS input
    JOIN public.products AS product_row
      ON product_row.merchant_id = p_merchant_id
      AND product_row.status = 'active'
      AND (
        product_row.slug = input.product_identifier
        OR product_row.id = input.product_id
      )
    JOIN public.merchants AS merchant_row
      ON merchant_row.id = product_row.merchant_id
      AND (
        COALESCE(merchant_row.is_published, false) = true
        OR COALESCE(merchant_row.is_platform_admin, false) = true
      )
    ORDER BY
      CASE WHEN product_row.slug = input.product_identifier THEN 0 ELSE 1 END,
      product_row.id
    LIMIT 1
  ),
  legacy_redirect_target AS MATERIALIZED (
    SELECT
      parent_product.id,
      parent_product.name,
      parent_product.slug,
      parent_product.status,
      parent_product.category,
      canonical_category.id AS category_id,
      canonical_category.name AS category_name,
      canonical_category.slug AS category_slug,
      canonical_category.parent_id AS category_parent_id
    FROM normalized_input AS input
    JOIN public.products AS legacy_product
      ON legacy_product.merchant_id = p_merchant_id
      AND legacy_product.status = 'archived'
      AND (
        legacy_product.slug = input.product_identifier
        OR legacy_product.id = input.product_id
      )
    JOIN public.products AS parent_product
      ON parent_product.id = legacy_product.parent_product_id
      AND parent_product.merchant_id = legacy_product.merchant_id
      AND parent_product.status = 'active'
      AND NULLIF(
        pg_catalog.btrim(parent_product.slug),
        ''
      ) IS NOT NULL
    JOIN public.merchants AS merchant_row
      ON merchant_row.id = parent_product.merchant_id
      AND (
        COALESCE(merchant_row.is_published, false) = true
        OR COALESCE(merchant_row.is_platform_admin, false) = true
      )
    LEFT JOIN LATERAL (
      SELECT
        category_candidate.id,
        category_candidate.name,
        category_candidate.slug,
        category_candidate.parent_id
      FROM (
        SELECT
          direct_category.id,
          direct_category.name,
          direct_category.slug,
          direct_category.parent_id,
          0 AS category_rank
        FROM public.categories AS direct_category
        WHERE direct_category.id = parent_product.category_id
          AND direct_category.is_active IS TRUE

        UNION ALL

        SELECT
          joined_category.id,
          joined_category.name,
          joined_category.slug,
          joined_category.parent_id,
          1 AS category_rank
        FROM public.product_categories AS membership
        JOIN public.categories AS joined_category
          ON joined_category.id = membership.category_id
          AND joined_category.is_active IS TRUE
        WHERE membership.product_id = parent_product.id
      ) AS category_candidate
      ORDER BY category_candidate.category_rank, category_candidate.id
      LIMIT 1
    ) AS canonical_category ON true
    ORDER BY
      CASE WHEN legacy_product.slug = input.product_identifier THEN 0 ELSE 1 END,
      legacy_product.id,
      parent_product.id
    LIMIT 1
  ),
  serialized_product_scope AS (
    SELECT product_row.id, product_row.merchant_id
    FROM selected_product AS product_row
    WHERE product_row.inventory_tracking_policy IN (
      'serialized_strict',
      'serialized_then_unlimited'
    )
      OR EXISTS (
        SELECT 1
        FROM public.product_variants AS variant_row
        WHERE variant_row.product_id = product_row.id
          AND variant_row.merchant_id = product_row.merchant_id
          AND variant_row.inventory_tracking_policy IN (
            'serialized_strict',
            'serialized_then_unlimited'
          )
      )
  ),
  availability_counts AS MATERIALIZED (
    SELECT
      availability.product_id,
      availability.variant_id,
      availability.public_available_units
    FROM serialized_product_scope AS product_row
    CROSS JOIN LATERAL private.get_public_serialized_variant_availability_counts(
      product_row.merchant_id,
      ARRAY[product_row.id]::uuid[],
      p_branch_id
    ) AS availability
  ),
  simple_inventory_state AS (
    SELECT
      product_row.id AS product_id,
      CASE
        WHEN product_row.has_variants IS TRUE THEN 'off'::text
        WHEN anchor_variant.inventory_tracking_policy IN (
          'off',
          'serialized_strict',
          'serialized_then_unlimited'
        ) THEN anchor_variant.inventory_tracking_policy
        WHEN product_row.inventory_tracking_policy IN (
          'serialized_strict',
          'serialized_then_unlimited'
        ) THEN product_row.inventory_tracking_policy
        ELSE 'off'::text
      END AS effective_policy,
      COALESCE(availability.public_available_units, 0) AS available_units
    FROM selected_product AS product_row
    LEFT JOIN LATERAL (
      SELECT variant_row.inventory_tracking_policy
      FROM public.product_variants AS variant_row
      WHERE variant_row.product_id = product_row.id
        AND variant_row.merchant_id = product_row.merchant_id
        AND variant_row.is_inventory_anchor IS TRUE
      ORDER BY variant_row.created_at, variant_row.id
      LIMIT 1
    ) AS anchor_variant ON true
    LEFT JOIN availability_counts AS availability
      ON availability.product_id = product_row.id
      AND availability.variant_id IS NULL
  ),
  variant_population AS MATERIALIZED (
    SELECT pg_catalog.count(variant_row.id)::integer AS total_count
    FROM selected_product AS product_row
    JOIN public.product_variants AS variant_row
      ON variant_row.product_id = product_row.id
      AND variant_row.merchant_id = product_row.merchant_id
      AND variant_row.is_inventory_anchor IS NOT TRUE
  ),
  variant_source AS MATERIALIZED (
    SELECT
      variant_row.id,
      variant_row.product_id,
      variant_row.sku,
      variant_row.attributes,
      variant_row.condition,
      variant_row.price_override,
      variant_row.images,
      variant_row.primary_image,
      variant_row.created_at,
      variant_row.updated_at,
      CASE
        WHEN variant_row.inventory_tracking_policy IN (
          'off',
          'serialized_strict',
          'serialized_then_unlimited'
        ) THEN variant_row.inventory_tracking_policy
        WHEN product_row.inventory_tracking_policy IN (
          'serialized_strict',
          'serialized_then_unlimited'
        ) THEN product_row.inventory_tracking_policy
        ELSE 'off'::text
      END AS effective_policy,
      variant_row.stock_quantity AS stored_stock_quantity,
      COALESCE(availability.public_available_units, 0) AS available_units
    FROM selected_product AS product_row
    JOIN public.product_variants AS variant_row
      ON variant_row.product_id = product_row.id
      AND variant_row.merchant_id = product_row.merchant_id
      AND variant_row.is_inventory_anchor IS NOT TRUE
    LEFT JOIN availability_counts AS availability
      ON availability.product_id = variant_row.product_id
      AND availability.variant_id = variant_row.id
    -- The critical snapshot stays bounded, but always retains the configured
    -- default and then the lowest-priced choices. `variants_truncated` below
    -- tells the application to use the existing full variant RPC for rare
    -- catalogs whose selected option falls outside this critical subset.
    ORDER BY
      (variant_row.id = product_row.default_variant_id) DESC,
      COALESCE(variant_row.price_override, product_row.price),
      variant_row.created_at,
      variant_row.id
    LIMIT 128
  ),
  variant_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', variant.id,
          'product_id', variant.product_id,
          'sku', variant.sku,
          'attributes', variant.attributes,
          'condition', variant.condition,
          'price_override', variant.price_override,
          'stock_quantity',
            CASE variant.effective_policy
              WHEN 'serialized_strict' THEN variant.available_units
              WHEN 'serialized_then_unlimited' THEN
                CASE
                  WHEN variant.available_units > 0 THEN variant.available_units
                  ELSE 9999
                END
              ELSE variant.stored_stock_quantity
            END,
          'images', variant.images,
          'primary_image', variant.primary_image,
          'created_at', variant.created_at,
          'updated_at', variant.updated_at,
          'inventory_tracking_policy', variant.effective_policy
        )
        ORDER BY variant.created_at, variant.id
      ),
      '[]'::jsonb
    ) AS data
    FROM variant_source AS variant
  ),
  offer_source AS MATERIALIZED (
    SELECT
      offer_row.id,
      offer_row.condition,
      offer_row.price,
      offer_row.compare_at_price,
      offer_row.stock_quantity,
      offer_row.images,
      offer_row.condition_notes,
      offer_row.grade,
      offer_row.status
    FROM selected_product AS product_row
    JOIN public.product_offers AS offer_row
      ON offer_row.product_id = product_row.id
      AND offer_row.merchant_id = product_row.merchant_id
      AND offer_row.status = 'active'
    ORDER BY offer_row.condition, offer_row.id
    LIMIT 16
  ),
  offer_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', offer.id,
          'condition', offer.condition,
          'price', offer.price,
          'compare_at_price', offer.compare_at_price,
          'stock_quantity', offer.stock_quantity,
          'images', offer.images,
          'condition_notes', offer.condition_notes,
          'grade', offer.grade,
          'status', offer.status
        )
        ORDER BY offer.condition, offer.id
      ),
      '[]'::jsonb
    ) AS data
    FROM offer_source AS offer
  ),
  key_spec_json AS (
    SELECT
      product_row.id AS product_id,
      CASE
        WHEN key_spec.product_id IS NULL THEN NULL::jsonb
        ELSE
          jsonb_build_object(
            'created_at', key_spec.created_at,
            'screen_size_inches', key_spec.screen_size_inches,
            'refresh_rate_hz', key_spec.refresh_rate_hz,
            'chipset', key_spec.chipset,
            'ram_gb', key_spec.ram_gb,
            'storage_gb', key_spec.storage_gb,
            'main_camera_mp', key_spec.main_camera_mp,
            'battery_mah', key_spec.battery_mah,
            'charging_watt', key_spec.charging_watt,
            'has_5g', key_spec.has_5g,
            'android_version', key_spec.android_version,
            'network_technology', key_spec.network_technology,
            'sim_type', key_spec.sim_type,
            'has_nfc', key_spec.has_nfc,
            'wifi_bands', key_spec.wifi_bands,
            'bluetooth_version', key_spec.bluetooth_version,
            'usb_type', key_spec.usb_type,
            'has_usb_otg', key_spec.has_usb_otg,
            'positioning', key_spec.positioning,
            'has_fm_radio', key_spec.has_fm_radio,
            'dimensions_mm', key_spec.dimensions_mm,
            'weight_g', key_spec.weight_g,
            'build_materials', key_spec.build_materials,
            'ip_rating', key_spec.ip_rating,
            'display_type', key_spec.display_type,
            'display_resolution', key_spec.display_resolution,
            'display_ppi', key_spec.display_ppi,
            'display_protection', key_spec.display_protection,
            'display_peak_brightness', key_spec.display_peak_brightness
          )
          ||
          jsonb_build_object(
            'front_camera_mp', key_spec.front_camera_mp,
            'front_camera_features', key_spec.front_camera_features,
            'front_camera_video', key_spec.front_camera_video,
            'rear_camera_features', key_spec.rear_camera_features,
            'rear_camera_video', key_spec.rear_camera_video,
            'has_dual_camera', key_spec.has_dual_camera,
            'has_triple_camera', key_spec.has_triple_camera,
            'has_quad_camera', key_spec.has_quad_camera,
            'has_stereo_speakers', key_spec.has_stereo_speakers,
            'has_headphone_jack', key_spec.has_headphone_jack,
            'fingerprint_type', key_spec.fingerprint_type,
            'sensors', key_spec.sensors,
            'battery_removable', key_spec.battery_removable,
            'has_wireless_charging', key_spec.has_wireless_charging,
            'wireless_charging_watt', key_spec.wireless_charging_watt,
            'has_reverse_charging', key_spec.has_reverse_charging,
            'cpu_cores', key_spec.cpu_cores,
            'gpu', key_spec.gpu,
            'has_card_slot', key_spec.has_card_slot,
            'card_slot_type', key_spec.card_slot_type,
            'available_colors', key_spec.available_colors,
            'model_numbers', key_spec.model_numbers,
            'announced_date', key_spec.announced_date,
            'release_date', key_spec.release_date,
            'camera_score', key_spec.camera_score,
            'battery_score', key_spec.battery_score,
            'gaming_score', key_spec.gaming_score,
            'recommended_for', key_spec.recommended_for,
            'has_ois', key_spec.has_ois
          )
      END AS data
    FROM selected_product AS product_row
    LEFT JOIN public.product_key_specs AS key_spec
      ON key_spec.product_id = product_row.id
  )
  SELECT
    'found'::text AS resolution_status,
    (
      jsonb_build_object(
        'id', product_row.id,
        'merchant_id', product_row.merchant_id,
        'category_id', product_row.category_id,
        'created_at', product_row.created_at,
        'updated_at', product_row.updated_at,
        'name', product_row.name,
        'description', product_row.description,
        'status', product_row.status,
        'price', product_row.price,
        'compare_at_price', product_row.compare_at_price,
        'stock',
          CASE inventory.effective_policy
            WHEN 'serialized_strict' THEN inventory.available_units
            WHEN 'serialized_then_unlimited' THEN
              CASE
                WHEN inventory.available_units > 0 THEN inventory.available_units
                ELSE 9999
              END
            ELSE product_row.stock
          END,
        'stock_quantity',
          CASE inventory.effective_policy
            WHEN 'serialized_strict' THEN inventory.available_units
            WHEN 'serialized_then_unlimited' THEN
              CASE
                WHEN inventory.available_units > 0 THEN inventory.available_units
                ELSE 9999
              END
            ELSE product_row.stock_quantity
          END,
        'manage_stock',
          CASE inventory.effective_policy
            WHEN 'serialized_strict' THEN true
            WHEN 'serialized_then_unlimited' THEN false
            ELSE product_row.manage_stock
          END,
        'low_stock_threshold', product_row.low_stock_threshold,
        'sku', product_row.sku,
        'slug', product_row.slug,
        'condition', product_row.condition,
        'condition_detail', product_row.condition_detail,
        'variant_model', product_row.variant_model,
        'default_variant_id', product_row.default_variant_id,
        'available_conditions', product_row.available_conditions,
        'min_variant_price', product_row.min_variant_price,
        'max_variant_price', product_row.max_variant_price,
        'brand', product_row.brand,
        'category', product_row.category
      )
      ||
      jsonb_build_object(
        'color', product_row.color,
        'has_variants', product_row.has_variants,
        'has_condition_offers', product_row.has_condition_offers,
        'variant_attributes', product_row.variant_attributes,
        'images', product_row.images,
        'imageHint', product_row.image_hint,
        'specifications', product_row.specifications,
        'weight_value', product_row.weight_value,
        'weight_unit', product_row.weight_unit,
        'dimensions', product_row.dimensions,
        'taxable', product_row.taxable,
        'tax_code', product_row.tax_code,
        'meta_title', product_row.meta_title,
        'meta_description', product_row.meta_description,
        'keywords', product_row.keywords,
        'canonical_url', product_row.canonical_url,
        'schema_markup', product_row.schema_markup,
        'gtin', product_row.gtin,
        'mpn', product_row.mpn,
        'google_product_category', product_row.google_product_category,
        'fulfillmentFields', product_row.fulfillment_fields,
        'inventory_tracking_policy', product_row.inventory_tracking_policy
      )
      ||
      jsonb_build_object(
        'categories',
          CASE
            WHEN canonical_category.id IS NULL THEN NULL::jsonb
            ELSE jsonb_build_object(
              'id', canonical_category.id,
              'name', canonical_category.name,
              'slug', canonical_category.slug,
              'parent_id', canonical_category.parent_id
            )
          END,
        'product_key_specs', key_specs.data,
        'product_offers', offers.data,
        'product_variants', variants.data,
        'variant_count', variant_population.total_count,
        'variants_truncated',
          variant_population.total_count >
            pg_catalog.jsonb_array_length(variants.data)
      )
    ) AS product_data
  FROM selected_product AS product_row
  LEFT JOIN simple_inventory_state AS inventory
    ON inventory.product_id = product_row.id
  LEFT JOIN LATERAL (
    SELECT
      category_candidate.id,
      category_candidate.name,
      category_candidate.slug,
      category_candidate.parent_id
    FROM (
      SELECT
        direct_category.id,
        direct_category.name,
        direct_category.slug,
        direct_category.parent_id,
        0 AS category_rank
      FROM public.categories AS direct_category
      WHERE direct_category.id = product_row.category_id
        AND direct_category.is_active IS TRUE

      UNION ALL

      SELECT
        joined_category.id,
        joined_category.name,
        joined_category.slug,
        joined_category.parent_id,
        1 AS category_rank
      FROM public.product_categories AS membership
      JOIN public.categories AS joined_category
        ON joined_category.id = membership.category_id
        AND joined_category.is_active IS TRUE
      WHERE membership.product_id = product_row.id
    ) AS category_candidate
    ORDER BY category_candidate.category_rank, category_candidate.id
    LIMIT 1
  ) AS canonical_category ON true
  LEFT JOIN key_spec_json AS key_specs
    ON key_specs.product_id = product_row.id
  CROSS JOIN offer_json AS offers
  CROSS JOIN variant_json AS variants
  CROSS JOIN variant_population

  UNION ALL

  SELECT
    'redirect'::text,
    jsonb_build_object(
      'id', redirect_target.id,
      'name', redirect_target.name,
      'slug', redirect_target.slug,
      'status', redirect_target.status,
      'category', redirect_target.category,
      'categories',
        CASE
          WHEN redirect_target.category_id IS NULL THEN NULL::jsonb
          ELSE jsonb_build_object(
            'id', redirect_target.category_id,
            'name', redirect_target.category_name,
            'slug', redirect_target.category_slug,
            'parent_id', redirect_target.category_parent_id
          )
        END
    )
  FROM legacy_redirect_target AS redirect_target
  WHERE NOT EXISTS (SELECT 1 FROM selected_product)

  UNION ALL

  SELECT
    'not_found'::text,
    NULL::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM selected_product)
    AND NOT EXISTS (SELECT 1 FROM legacy_redirect_target);
$$;

CREATE OR REPLACE FUNCTION public.get_storefront_pdp_core_v2(
  p_merchant_id uuid,
  p_product_slug text,
  p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE (
  resolution_status text,
  product_data jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT
    snapshot.resolution_status,
    snapshot.product_data
  FROM private.get_storefront_pdp_core_v2(
    p_merchant_id,
    p_product_slug,
    p_branch_id
  ) AS snapshot;
$$;

REVOKE ALL ON FUNCTION private.get_storefront_pdp_core_v2(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_storefront_pdp_core_v2(uuid, text, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_storefront_pdp_core_v2(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_storefront_pdp_core_v2(uuid, text, uuid)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_storefront_pdp_core_v2(uuid, text, uuid) IS
  'One-round-trip public PDP core snapshot with canonical category, bounded offers/variants, key specs, and serialized availability.';

-- Optional semantic links stay outside the route-critical/LCP snapshot, but
-- one categorized PDP must not fan out into category, product, key-spec, and
-- guide queries. This read model combines those bounded projections into one
-- Data API call while preserving the application-owned cluster classifier.
CREATE OR REPLACE FUNCTION private.get_storefront_pdp_semantic_enrichment_v1(
  p_merchant_id uuid,
  p_product_id uuid,
  p_category_slug text,
  p_cluster_rules jsonb,
  p_search_query text,
  p_include_guides boolean DEFAULT true,
  p_inventory_limit integer DEFAULT 48,
  p_cluster_guide_limit integer DEFAULT 48,
  p_product_guide_limit integer DEFAULT 8
)
RETURNS TABLE (
  resolution_status text,
  inventory_data jsonb,
  cluster_guide_data jsonb,
  product_guide_data jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
ROWS 1
AS $$
  WITH raw_input AS MATERIALIZED (
    SELECT
      COALESCE(p_category_slug, '') AS category_slug,
      COALESCE(p_include_guides, false) AS include_guides,
      LEAST(
        GREATEST(COALESCE(p_inventory_limit, 48), 1),
        48
      ) AS inventory_limit,
      LEAST(
        GREATEST(COALESCE(p_cluster_guide_limit, 48), 1),
        48
      ) AS cluster_guide_limit,
      LEAST(
        GREATEST(COALESCE(p_product_guide_limit, 8), 1),
        8
      ) AS product_guide_limit
  ),
  validated_input AS MATERIALIZED (
    SELECT
      raw_input.*,
      p_merchant_id IS NOT NULL
        AND p_product_id IS NOT NULL
        AND pg_catalog.btrim(raw_input.category_slug) <> ''
        AND pg_catalog.octet_length(raw_input.category_slug) <= 64 AS valid
    FROM raw_input
  ),
  input AS MATERIALIZED (
    SELECT
      CASE
        WHEN validated_input.valid THEN pg_catalog.lower(
          pg_catalog.btrim(validated_input.category_slug)
        )
        ELSE ''::text
      END AS category_slug,
      CASE
        WHEN validated_input.valid THEN pg_catalog.btrim(
          pg_catalog.regexp_replace(
            pg_catalog.regexp_replace(
              pg_catalog.lower(validated_input.category_slug),
              '[-_]+',
              ' ',
              'g'
            ),
            '[^[:alnum:] ]+',
            '',
            'g'
          )
        )
        ELSE ''::text
      END AS legacy_category_name,
      validated_input.include_guides,
      validated_input.inventory_limit,
      validated_input.cluster_guide_limit,
      validated_input.product_guide_limit,
      validated_input.valid
    FROM validated_input
  ),
  current_product AS MATERIALIZED (
    SELECT
      product_row.id,
      product_row.merchant_id,
      product_row.category_id,
      product_row.created_at,
      product_row.slug,
      product_row.name,
      product_row.brand,
      product_row.condition,
      product_row.price,
      product_row.stock,
      product_row.stock_quantity,
      product_row.category
    FROM input
    JOIN public.products AS product_row
      ON input.valid
      AND product_row.id = p_product_id
      AND product_row.merchant_id = p_merchant_id
      AND product_row.status = 'active'
    JOIN public.merchants AS merchant_row
      ON merchant_row.id = product_row.merchant_id
      AND (
        COALESCE(merchant_row.is_published, false) = true
        OR COALESCE(merchant_row.is_platform_admin, false) = true
      )
    LIMIT 1
  ),
  category_state AS MATERIALIZED (
    SELECT
      category_row.id,
      category_row.is_active
    FROM input
    JOIN public.categories AS category_row
      ON category_row.merchant_id = p_merchant_id
      AND category_row.slug = input.category_slug
    ORDER BY category_row.id
    LIMIT 1
  ),
  category_scope AS MATERIALIZED (
    SELECT category_row.id
    FROM category_state AS requested_category
    JOIN public.categories AS category_row
      ON category_row.merchant_id = p_merchant_id
      AND category_row.is_active IS TRUE
      AND (
        category_row.id = requested_category.id
        OR category_row.parent_id = requested_category.id
      )
    WHERE requested_category.is_active IS TRUE
  ),
  scoped_products AS MATERIALIZED (
    SELECT
      product_row.id,
      product_row.merchant_id,
      product_row.category_id,
      product_row.created_at,
      product_row.slug,
      product_row.name,
      product_row.brand,
      product_row.condition,
      product_row.price,
      product_row.stock,
      product_row.stock_quantity,
      product_row.category
    FROM input
    CROSS JOIN current_product
    JOIN public.products AS product_row
      ON product_row.merchant_id = p_merchant_id
      AND product_row.status = 'active'
      AND product_row.id <> p_product_id
    WHERE (
      (
        EXISTS (
          SELECT 1
          FROM category_state
          WHERE category_state.is_active IS TRUE
        )
        AND (
          product_row.category_id IN (SELECT category_scope.id FROM category_scope)
          OR EXISTS (
            SELECT 1
            FROM public.product_categories AS membership
            WHERE membership.product_id = product_row.id
              AND membership.category_id IN (
                SELECT category_scope.id FROM category_scope
              )
          )
        )
      )
      OR (
        NOT EXISTS (SELECT 1 FROM category_state)
        AND input.legacy_category_name <> ''
        AND (
          COALESCE(product_row.category, '') OPERATOR(pg_catalog.~~*)
            ('%' || input.legacy_category_name || '%')
          OR COALESCE(product_row.brand, '') OPERATOR(pg_catalog.~~*)
            ('%' || input.legacy_category_name || '%')
          OR product_row.name OPERATOR(pg_catalog.~~*)
            ('%' || input.legacy_category_name || '%')
        )
      )
    )
    ORDER BY product_row.created_at DESC, product_row.id
    LIMIT (SELECT input.inventory_limit FROM input)
  ),
  candidate_products AS MATERIALIZED (
    SELECT
      current_product.id,
      current_product.merchant_id,
      current_product.category_id,
      current_product.created_at,
      current_product.slug,
      current_product.name,
      current_product.brand,
      current_product.condition,
      current_product.price,
      current_product.stock,
      current_product.stock_quantity,
      current_product.category,
      true AS is_current
    FROM current_product

    UNION ALL

    SELECT
      scoped_products.id,
      scoped_products.merchant_id,
      scoped_products.category_id,
      scoped_products.created_at,
      scoped_products.slug,
      scoped_products.name,
      scoped_products.brand,
      scoped_products.condition,
      scoped_products.price,
      scoped_products.stock,
      scoped_products.stock_quantity,
      scoped_products.category,
      false AS is_current
    FROM scoped_products
  ),
  inventory_rows AS MATERIALIZED (
    SELECT
      candidate.id,
      candidate.created_at,
      candidate.is_current,
      jsonb_build_object(
        'id', candidate.id,
        'slug', candidate.slug,
        'name', candidate.name,
        'brand', candidate.brand,
        'condition', candidate.condition,
        'price', candidate.price,
        'stock', candidate.stock,
        'stock_quantity', candidate.stock_quantity,
        'category', candidate.category,
        'category_id', candidate.category_id,
        'categories',
          CASE
            WHEN canonical_category.slug IS NULL THEN NULL::jsonb
            ELSE jsonb_build_object('slug', canonical_category.slug)
          END,
        'product_key_specs',
          CASE
            WHEN key_spec.product_id IS NULL THEN NULL::jsonb
            ELSE
              jsonb_build_object(
                'created_at', key_spec.created_at,
                'screen_size_inches', key_spec.screen_size_inches,
                'refresh_rate_hz', key_spec.refresh_rate_hz,
                'chipset', key_spec.chipset,
                'ram_gb', key_spec.ram_gb,
                'storage_gb', key_spec.storage_gb,
                'main_camera_mp', key_spec.main_camera_mp,
                'battery_mah', key_spec.battery_mah,
                'charging_watt', key_spec.charging_watt,
                'has_5g', key_spec.has_5g,
                'android_version', key_spec.android_version,
                'network_technology', key_spec.network_technology,
                'sim_type', key_spec.sim_type,
                'has_nfc', key_spec.has_nfc,
                'wifi_bands', key_spec.wifi_bands,
                'bluetooth_version', key_spec.bluetooth_version,
                'usb_type', key_spec.usb_type,
                'has_usb_otg', key_spec.has_usb_otg,
                'positioning', key_spec.positioning,
                'has_fm_radio', key_spec.has_fm_radio,
                'dimensions_mm', key_spec.dimensions_mm,
                'weight_g', key_spec.weight_g,
                'build_materials', key_spec.build_materials,
                'ip_rating', key_spec.ip_rating,
                'display_type', key_spec.display_type,
                'display_resolution', key_spec.display_resolution,
                'display_ppi', key_spec.display_ppi,
                'display_protection', key_spec.display_protection,
                'display_peak_brightness', key_spec.display_peak_brightness
              )
              ||
              jsonb_build_object(
                'front_camera_mp', key_spec.front_camera_mp,
                'front_camera_features', key_spec.front_camera_features,
                'front_camera_video', key_spec.front_camera_video,
                'rear_camera_features', key_spec.rear_camera_features,
                'rear_camera_video', key_spec.rear_camera_video,
                'has_dual_camera', key_spec.has_dual_camera,
                'has_triple_camera', key_spec.has_triple_camera,
                'has_quad_camera', key_spec.has_quad_camera,
                'has_stereo_speakers', key_spec.has_stereo_speakers,
                'has_headphone_jack', key_spec.has_headphone_jack,
                'fingerprint_type', key_spec.fingerprint_type,
                'sensors', key_spec.sensors,
                'battery_removable', key_spec.battery_removable,
                'has_wireless_charging', key_spec.has_wireless_charging,
                'wireless_charging_watt', key_spec.wireless_charging_watt,
                'has_reverse_charging', key_spec.has_reverse_charging,
                'cpu_cores', key_spec.cpu_cores,
                'gpu', key_spec.gpu,
                'has_card_slot', key_spec.has_card_slot,
                'card_slot_type', key_spec.card_slot_type,
                'available_colors', key_spec.available_colors,
                'model_numbers', key_spec.model_numbers,
                'announced_date', key_spec.announced_date,
                'release_date', key_spec.release_date,
                'camera_score', key_spec.camera_score,
                'battery_score', key_spec.battery_score,
                'gaming_score', key_spec.gaming_score,
                'recommended_for', key_spec.recommended_for,
                'has_ois', key_spec.has_ois
              )
          END
      ) AS data
    FROM candidate_products AS candidate
    LEFT JOIN LATERAL (
      SELECT category_candidate.slug
      FROM (
        SELECT
          direct_category.slug,
          0 AS category_rank,
          direct_category.id
        FROM public.categories AS direct_category
        WHERE direct_category.id = candidate.category_id
          AND direct_category.is_active IS TRUE

        UNION ALL

        SELECT
          joined_category.slug,
          CASE WHEN membership.is_primary IS TRUE THEN 1 ELSE 2 END,
          joined_category.id
        FROM public.product_categories AS membership
        JOIN public.categories AS joined_category
          ON joined_category.id = membership.category_id
          AND joined_category.is_active IS TRUE
        WHERE membership.product_id = candidate.id
      ) AS category_candidate
      ORDER BY category_candidate.category_rank, category_candidate.id
      LIMIT 1
    ) AS canonical_category ON true
    LEFT JOIN public.product_key_specs AS key_spec
      ON key_spec.product_id = candidate.id
  ),
  inventory_json AS (
    SELECT COALESCE(
      jsonb_agg(
        inventory_rows.data
        ORDER BY
          inventory_rows.is_current DESC,
          inventory_rows.created_at DESC,
          inventory_rows.id
      ),
      '[]'::jsonb
    ) AS data
    FROM inventory_rows
  ),
  blog_enabled AS MATERIALIZED (
    SELECT EXISTS (
      SELECT 1
      FROM public.merchant_feature_settings AS settings
      WHERE settings.merchant_id = p_merchant_id
        AND settings.blog_enabled IS TRUE
    ) AS enabled
  ),
  cluster_guide_source AS MATERIALIZED (
    SELECT
      guide.slug,
      guide.title,
      guide.excerpt,
      guide.category,
      guide.tags,
      guide.keywords,
      guide.featured_image_url,
      guide.published_at,
      guide.reading_time_minutes,
      guide.guide_order
    FROM input
    CROSS JOIN current_product
    CROSS JOIN blog_enabled
    CROSS JOIN LATERAL public.get_storefront_cluster_guide_candidates_v1(
      p_merchant_id,
      input.category_slug,
      p_cluster_rules,
      p_search_query,
      input.cluster_guide_limit
    ) WITH ORDINALITY AS guide(
      slug,
      title,
      excerpt,
      category,
      tags,
      keywords,
      featured_image_url,
      published_at,
      reading_time_minutes,
      guide_order
    )
    WHERE input.include_guides
      AND blog_enabled.enabled
  ),
  cluster_guide_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'slug', guide.slug,
          'title', guide.title,
          'excerpt', guide.excerpt,
          'category', guide.category,
          'tags', guide.tags,
          'keywords', guide.keywords,
          'featured_image_url', guide.featured_image_url,
          'published_at', guide.published_at,
          'reading_time_minutes', guide.reading_time_minutes
        )
        ORDER BY guide.guide_order
      ),
      '[]'::jsonb
    ) AS data
    FROM cluster_guide_source AS guide
  ),
  product_guide_source AS MATERIALIZED (
    SELECT
      post.slug,
      post.title,
      post.excerpt,
      post.category,
      post.tags,
      post.keywords,
      post.featured_image_url,
      post.published_at,
      post.reading_time_minutes,
      link.created_at AS linked_at
    FROM input
    CROSS JOIN current_product
    CROSS JOIN blog_enabled
    JOIN public.blog_post_products AS link
      ON link.merchant_id = p_merchant_id
      AND link.product_id = p_product_id
    JOIN public.blog_posts AS post
      ON post.id = link.blog_post_id
      AND post.merchant_id = p_merchant_id
      AND post.status = 'published'
      AND post.published_at IS NOT NULL
      AND pg_catalog.btrim(post.slug) <> ''
      AND pg_catalog.btrim(post.title) <> ''
    WHERE input.include_guides
      AND blog_enabled.enabled
    ORDER BY link.created_at DESC, post.published_at DESC, post.slug
    LIMIT (SELECT input.product_guide_limit FROM input)
  ),
  product_guide_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'slug', guide.slug,
          'title', guide.title,
          'excerpt', guide.excerpt,
          'category', guide.category,
          'tags', guide.tags,
          'keywords', guide.keywords,
          'featured_image_url', guide.featured_image_url,
          'published_at', guide.published_at,
          'reading_time_minutes', guide.reading_time_minutes
        )
        ORDER BY guide.linked_at DESC, guide.published_at DESC, guide.slug
      ),
      '[]'::jsonb
    ) AS data
    FROM product_guide_source AS guide
  )
  SELECT
    'found'::text,
    inventory_json.data,
    cluster_guide_json.data,
    product_guide_json.data
  FROM input
  CROSS JOIN inventory_json
  CROSS JOIN cluster_guide_json
  CROSS JOIN product_guide_json
  WHERE EXISTS (SELECT 1 FROM current_product)

  UNION ALL

  SELECT
    'not_found'::text,
    NULL::jsonb,
    NULL::jsonb,
    NULL::jsonb
  FROM input
  WHERE NOT EXISTS (SELECT 1 FROM current_product);
$$;

CREATE OR REPLACE FUNCTION public.get_storefront_pdp_semantic_enrichment_v1(
  p_merchant_id uuid,
  p_product_id uuid,
  p_category_slug text,
  p_cluster_rules jsonb,
  p_search_query text,
  p_include_guides boolean DEFAULT true,
  p_inventory_limit integer DEFAULT 48,
  p_cluster_guide_limit integer DEFAULT 48,
  p_product_guide_limit integer DEFAULT 8
)
RETURNS TABLE (
  resolution_status text,
  inventory_data jsonb,
  cluster_guide_data jsonb,
  product_guide_data jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
ROWS 1
AS $$
  SELECT
    enrichment.resolution_status,
    enrichment.inventory_data,
    enrichment.cluster_guide_data,
    enrichment.product_guide_data
  FROM private.get_storefront_pdp_semantic_enrichment_v1(
    p_merchant_id,
    p_product_id,
    p_category_slug,
    p_cluster_rules,
    p_search_query,
    p_include_guides,
    p_inventory_limit,
    p_cluster_guide_limit,
    p_product_guide_limit
  ) AS enrichment;
$$;

REVOKE ALL ON FUNCTION private.get_storefront_pdp_semantic_enrichment_v1(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  boolean,
  integer,
  integer,
  integer
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_storefront_pdp_semantic_enrichment_v1(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  boolean,
  integer,
  integer,
  integer
) TO service_role;

REVOKE ALL ON FUNCTION public.get_storefront_pdp_semantic_enrichment_v1(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  boolean,
  integer,
  integer,
  integer
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_storefront_pdp_semantic_enrichment_v1(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  boolean,
  integer,
  integer,
  integer
) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_storefront_pdp_semantic_enrichment_v1(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  boolean,
  integer,
  integer,
  integer
) IS
  'One-call optional PDP semantic inventory and guide snapshot with current-product inclusion, canonical category slugs, explicit found/not_found status, and hard result limits.';
