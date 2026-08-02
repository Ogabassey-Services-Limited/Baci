-- Correct the durable cache-invalidation substrate after exact-head review.
-- The original B0 migration remains immutable; this migration widens public
-- product coverage, preserves all slug aliases, and exposes a bounded alert.

CREATE OR REPLACE FUNCTION public.enqueue_storefront_cache_targets(
  p_merchant_id uuid,
  p_additional_slug text DEFAULT NULL,
  p_additional_hostname text DEFAULT NULL,
  p_product_slugs text[] DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slug text;
  v_target text;
BEGIN
  SELECT merchant.slug INTO v_slug
  FROM public.merchants AS merchant
  WHERE merchant.id = p_merchant_id;
  IF v_slug IS NULL THEN RETURN; END IF;

  FOR v_target IN
    SELECT DISTINCT candidate
    FROM (
      SELECT v_slug AS candidate
      UNION ALL SELECT p_additional_slug
      UNION ALL
      SELECT alias.old_slug
      FROM public.merchant_slug_aliases AS alias
      WHERE alias.merchant_id = p_merchant_id
    ) AS targets
    WHERE candidate IS NOT NULL
  LOOP
    PERFORM public.enqueue_cache_invalidation_target(
      p_merchant_id, 'storefront_slug', v_target,
      ARRAY[v_slug, p_additional_slug, v_target], p_product_slugs
    );
  END LOOP;
  FOR v_target IN
    SELECT DISTINCT candidate
    FROM (
      SELECT domain_row.domain AS candidate
      FROM public.domains AS domain_row
      WHERE domain_row.merchant_id = p_merchant_id
        AND domain_row.status = 'active'
        AND domain_row.verified_at IS NOT NULL
      UNION ALL SELECT p_additional_hostname
    ) AS targets
    WHERE candidate IS NOT NULL
  LOOP
    PERFORM public.enqueue_cache_invalidation_target(
      p_merchant_id, 'storefront_hostname', v_target,
      ARRAY[v_slug, p_additional_slug, v_target], p_product_slugs
    );
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_cache_targets(
  uuid, text, text, text[]
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enqueue_storefront_cache_from_tenant_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
BEGIN
  IF TG_TABLE_NAME = 'categories' AND NOT (
    coalesce((v_old->>'is_active')::boolean, true)
    OR coalesce((v_new->>'is_active')::boolean, true)
  ) THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_TABLE_NAME = 'products' THEN
    IF NOT (
      coalesce(v_old->>'status' = 'active', false)
      OR coalesce(v_new->>'status' = 'active', false)
    ) THEN
      RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    IF TG_OP = 'UPDATE'
      AND (v_old - 'stock' - 'stock_quantity' - 'updated_at')
        IS NOT DISTINCT FROM
        (v_new - 'stock' - 'stock_quantity' - 'updated_at')
      AND (
        v_old->'stock' IS DISTINCT FROM v_new->'stock'
        OR v_old->'stock_quantity' IS DISTINCT FROM v_new->'stock_quantity'
      )
      AND NOT (
        coalesce((v_old->>'manage_stock')::boolean, false)
        OR coalesce((v_new->>'manage_stock')::boolean, false)
      )
    THEN RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM public.enqueue_storefront_cache_targets(
      OLD.merchant_id, NULL, NULL,
      CASE WHEN TG_TABLE_NAME = 'products'
        THEN ARRAY[v_old->>'slug', v_old->>'id'] ELSE '{}' END
    );
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.merchant_id IS DISTINCT FROM NEW.merchant_id THEN
    PERFORM public.enqueue_storefront_cache_targets(
      OLD.merchant_id, NULL, NULL,
      CASE WHEN TG_TABLE_NAME = 'products'
        THEN ARRAY[v_old->>'slug', v_old->>'id'] ELSE '{}' END
    );
  END IF;
  PERFORM public.enqueue_storefront_cache_targets(
    NEW.merchant_id, NULL, NULL,
    CASE WHEN TG_TABLE_NAME = 'products'
      THEN ARRAY[v_old->>'slug', v_old->>'id', v_new->>'slug', v_new->>'id']
      ELSE '{}' END
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_cache_from_tenant_row()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS products_enqueue_cache_invalidation ON public.products;
CREATE TRIGGER products_enqueue_cache_invalidation
AFTER INSERT OR DELETE OR UPDATE OF name, slug, description, price,
  compare_at_price, images, color_images, image_hint, status, category,
  category_id, meta_title, meta_description, keywords, canonical_url,
  schema_markup, faqs, specifications, offers, available_conditions,
  condition, condition_detail, has_condition_offers, has_variants, brand,
  brand_id, color, parent_product_id, default_variant_id, manage_stock,
  inventory_tracking_policy, stock, stock_quantity, merchant_id, gtin, mpn,
  google_product_category, sku, low_stock_threshold, variant_attributes,
  variant_model, min_variant_price, max_variant_price, dimensions,
  weight_value, weight_unit, metadata, fulfillment_details,
  fulfillment_fields, average_rating, review_count, is_parent,
  inventory_anchor_variant_id, taxable, tax_exempt, tax_code, vat_rate,
  vat_category_code, commodity_code, unit_code, created_at, updated_at
ON public.products FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_tenant_row();

CREATE INDEX IF NOT EXISTS cache_invalidation_outbox_dead_letter_idx
  ON public.cache_invalidation_outbox (updated_at)
  WHERE status = 'dead_letter';

CREATE FUNCTION public.has_cache_invalidation_dead_letters()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox AS outbox
    WHERE outbox.status = 'dead_letter'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.has_cache_invalidation_dead_letters()
  FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.has_cache_invalidation_dead_letters()
  TO service_role;
