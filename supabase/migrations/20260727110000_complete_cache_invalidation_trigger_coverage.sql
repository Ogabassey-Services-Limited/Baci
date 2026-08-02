-- Complete cache-invalidation coverage after the B0 exact-head review.
-- Earlier outbox migrations remain immutable; this append-only repair covers
-- feed configuration, category memberships, and inventory-anchor visibility.

DROP TRIGGER IF EXISTS merchants_enqueue_cache_invalidation_on_update
  ON public.merchants;
CREATE TRIGGER merchants_enqueue_cache_invalidation_on_update
AFTER UPDATE OF slug, is_published, business_name, site_title, site_tagline,
  site_description, business_type, logo_url, phone, email, support_email,
  support_phone, social_media, brand_colors, business_address,
  legal_entity_name, registered_address, tax_identification_number,
  trust_profile, payout_currency, template_id, plan_expires_at, plan_tier,
  premium_features, country, hero_slides, mobile_hero_slides,
  favicon_svg_url, favicon_png_32_url, favicon_png_192_url,
  favicon_apple_touch_url, vat_registration_status, vat_rate,
  feature_settings, published_config, pages, about_page, faq_items,
  gmc_variants_enabled
ON public.merchants FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_merchant();

-- Fail closed on legacy cross-tenant memberships before enforcing the invariant.
-- This join table has no dependent state; removing the invalid edge preserves
-- both tenant catalogs instead of granting either tenant authority over it.
WITH deleted_memberships AS (
  DELETE FROM public.product_categories AS membership
  USING public.products AS product, public.categories AS category
  WHERE membership.product_id = product.id
    AND membership.category_id = category.id
    AND product.merchant_id IS DISTINCT FROM category.merchant_id
  RETURNING membership.product_id
), affected_products AS (
  SELECT product.merchant_id, product.slug, product.id::text AS product_id
  FROM deleted_memberships AS membership
  JOIN public.products AS product ON product.id = membership.product_id
  WHERE product.status = 'active'
)
SELECT public.enqueue_storefront_cache_targets(
  product.merchant_id,
  NULL,
  NULL,
  array_agg(DISTINCT product_identifier)
)
FROM affected_products AS product
CROSS JOIN LATERAL unnest(
  ARRAY[product.slug, product.product_id]
) AS product_identifier
GROUP BY product.merchant_id;

CREATE OR REPLACE FUNCTION public.validate_product_category_merchant_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.products AS product
    JOIN public.categories AS category
      ON category.id = NEW.category_id
      AND category.merchant_id = product.merchant_id
    WHERE product.id = NEW.product_id
  ) THEN
    RAISE EXCEPTION 'product and category must belong to the same merchant'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_product_category_merchant_match()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS product_categories_validate_merchant_match
  ON public.product_categories;
CREATE TRIGGER product_categories_validate_merchant_match
BEFORE INSERT OR UPDATE OF product_id, category_id ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.validate_product_category_merchant_match();

DROP POLICY IF EXISTS product_categories_manage_policy
  ON public.product_categories;
CREATE POLICY product_categories_manage_policy
ON public.product_categories TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.products AS product
    JOIN public.merchants AS merchant ON merchant.id = product.merchant_id
    JOIN public.categories AS category
      ON category.id = product_categories.category_id
      AND category.merchant_id = product.merchant_id
    WHERE product.id = product_categories.product_id
      AND merchant.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.products AS product
    JOIN public.merchants AS merchant ON merchant.id = product.merchant_id
    JOIN public.categories AS category
      ON category.id = product_categories.category_id
      AND category.merchant_id = product.merchant_id
    WHERE product.id = product_categories.product_id
      AND merchant.user_id = (SELECT auth.uid())
  )
);

CREATE FUNCTION public.enqueue_storefront_cache_from_product_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_product_id uuid := CASE WHEN TG_OP <> 'INSERT' THEN OLD.product_id END;
  v_old_category_id uuid := CASE WHEN TG_OP <> 'INSERT' THEN OLD.category_id END;
  v_new_product_id uuid := CASE WHEN TG_OP <> 'DELETE' THEN NEW.product_id END;
  v_new_category_id uuid := CASE WHEN TG_OP <> 'DELETE' THEN NEW.category_id END;
  v_target record;
BEGIN
  FOR v_target IN
    WITH relationships(product_id, category_id) AS (
      VALUES
        (v_old_product_id, v_old_category_id),
        (v_new_product_id, v_new_category_id)
    ), candidates AS (
      SELECT product.merchant_id, product.slug AS product_slug,
        product.id::text AS product_id
      FROM relationships AS relationship
      JOIN public.products AS product ON product.id = relationship.product_id
      JOIN public.categories AS category
        ON category.id = relationship.category_id
        AND category.merchant_id = product.merchant_id
      WHERE product.status = 'active'
    )
    SELECT candidate.merchant_id,
      coalesce(
        array_agg(DISTINCT product_identifier)
          FILTER (WHERE product_identifier IS NOT NULL),
        '{}'::text[]
      ) AS product_identifiers
    FROM candidates AS candidate
    CROSS JOIN LATERAL unnest(
      ARRAY[candidate.product_slug, candidate.product_id]
    ) AS product_identifier
    GROUP BY candidate.merchant_id
  LOOP
    PERFORM public.enqueue_storefront_cache_targets(
      v_target.merchant_id, NULL, NULL, v_target.product_identifiers
    );
  END LOOP;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_cache_from_product_category()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER product_categories_enqueue_cache_invalidation
AFTER INSERT OR UPDATE OR DELETE ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_product_category();

CREATE OR REPLACE FUNCTION public.enqueue_storefront_cache_from_variant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_manage_stock boolean;
  v_merchant_id uuid;
  v_product_id uuid;
  v_product_slug text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    SELECT merchant_id, slug INTO v_merchant_id, v_product_slug
    FROM public.products WHERE id = OLD.product_id AND status = 'active';
    PERFORM public.enqueue_storefront_cache_targets(
      v_merchant_id, NULL, NULL, ARRAY[v_product_slug, OLD.product_id::text]
    );
  END IF;
  v_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;
  SELECT merchant_id, coalesce(manage_stock, false), slug
  INTO v_merchant_id, v_manage_stock, v_product_slug FROM public.products
  WHERE id = v_product_id AND status = 'active';
  IF v_merchant_id IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'UPDATE'
    AND NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity
    AND ROW(NEW.attributes, NEW.condition, NEW.images, NEW.primary_image,
      NEW.price_override, NEW.sku, NEW.variant_key,
      NEW.inventory_tracking_policy, NEW.product_id,
      NEW.is_inventory_anchor)
      IS NOT DISTINCT FROM ROW(OLD.attributes, OLD.condition, OLD.images,
      OLD.primary_image, OLD.price_override, OLD.sku, OLD.variant_key,
      OLD.inventory_tracking_policy, OLD.product_id,
      OLD.is_inventory_anchor)
    AND NOT v_manage_stock
  THEN RETURN NEW; END IF;
  PERFORM public.enqueue_storefront_cache_targets(
    v_merchant_id, NULL, NULL, ARRAY[v_product_slug, v_product_id::text]
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_cache_from_variant()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS product_variants_enqueue_cache_invalidation
  ON public.product_variants;
CREATE TRIGGER product_variants_enqueue_cache_invalidation
AFTER INSERT OR DELETE OR UPDATE OF attributes, condition, images,
  primary_image, price_override, sku, stock_quantity, variant_key,
  inventory_tracking_policy, product_id, is_inventory_anchor
ON public.product_variants FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_variant();
