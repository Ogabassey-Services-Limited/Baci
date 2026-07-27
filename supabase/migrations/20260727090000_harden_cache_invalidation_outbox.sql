-- Repair cache-invalidation trigger coverage without rewriting the deployed
-- outbox migration. All functions remain trigger-only and inaccessible to API
-- roles; the VPS drainer is the sole service-role RPC consumer.

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
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;

  IF TG_TABLE_NAME = 'categories' AND NOT (
    coalesce((v_old->>'is_active')::boolean, false)
    OR coalesce((v_new->>'is_active')::boolean, false)
  ) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'products' THEN
    IF NOT (
      coalesce(v_old->>'status', '') = 'active'
      OR coalesce(v_new->>'status', '') = 'active'
    ) THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
      AND (v_old - 'stock' - 'stock_quantity' - 'updated_at')
        IS NOT DISTINCT FROM
        (v_new - 'stock' - 'stock_quantity' - 'updated_at')
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

DROP TRIGGER products_enqueue_cache_invalidation ON public.products;
CREATE TRIGGER products_enqueue_cache_invalidation
AFTER INSERT OR DELETE OR UPDATE OF name, slug, description, price,
  compare_at_price, images, color_images, image_hint, status, category,
  category_id, meta_title, meta_description, keywords, canonical_url,
  schema_markup, faqs, specifications, offers, available_conditions,
  condition, has_condition_offers, has_variants, brand, color, gtin, mpn,
  google_product_category, parent_product_id, default_variant_id, manage_stock,
  inventory_tracking_policy, stock, stock_quantity, merchant_id
ON public.products FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_tenant_row();

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
    IF v_merchant_id IS NOT NULL THEN
      PERFORM public.enqueue_storefront_cache_targets(
        v_merchant_id, NULL, NULL, ARRAY[v_product_slug, OLD.product_id::text]
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
  ELSE
    v_product_id := NEW.product_id;
  END IF;
  SELECT merchant_id, coalesce(manage_stock, false), slug
  INTO v_merchant_id, v_manage_stock, v_product_slug
  FROM public.products WHERE id = v_product_id AND status = 'active';
  IF v_merchant_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
    AND NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity
    AND ROW(NEW.attributes, NEW.condition, NEW.images, NEW.primary_image,
      NEW.price_override, NEW.sku, NEW.variant_key,
      NEW.inventory_tracking_policy, NEW.product_id)
      IS NOT DISTINCT FROM ROW(OLD.attributes, OLD.condition, OLD.images,
      OLD.primary_image, OLD.price_override, OLD.sku, OLD.variant_key,
      OLD.inventory_tracking_policy, OLD.product_id)
    AND NOT v_manage_stock
  THEN RETURN NEW; END IF;
  PERFORM public.enqueue_storefront_cache_targets(
    v_merchant_id, NULL, NULL, ARRAY[v_product_slug, v_product_id::text]
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_cache_from_variant()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enqueue_storefront_cache_from_domain()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_old_hostname text;
BEGIN
  IF TG_OP <> 'INSERT'
    AND OLD.status = 'active'
    AND OLD.verified_at IS NOT NULL
  THEN v_old_hostname := OLD.domain; END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.enqueue_storefront_cache_targets(
      OLD.merchant_id, NULL, v_old_hostname
    );
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.merchant_id IS DISTINCT FROM NEW.merchant_id THEN
    PERFORM public.enqueue_storefront_cache_targets(
      OLD.merchant_id, NULL, v_old_hostname
    );
  END IF;
  PERFORM public.enqueue_storefront_cache_targets(
    NEW.merchant_id, NULL, v_old_hostname
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_cache_from_domain()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.enqueue_storefront_cache_from_product_category()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_merchant_id uuid;
  v_product_id uuid;
  v_product_slug text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    SELECT merchant_id, slug INTO v_merchant_id, v_product_slug
    FROM public.products WHERE id = OLD.product_id AND status = 'active';
    IF v_merchant_id IS NOT NULL THEN
      PERFORM public.enqueue_storefront_cache_targets(
        v_merchant_id, NULL, NULL, ARRAY[v_product_slug, OLD.product_id::text]
      );
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN v_product_id := OLD.product_id;
  ELSE v_product_id := NEW.product_id; END IF;
  SELECT merchant_id, slug INTO v_merchant_id, v_product_slug
  FROM public.products WHERE id = v_product_id AND status = 'active';
  IF v_merchant_id IS NOT NULL THEN
    PERFORM public.enqueue_storefront_cache_targets(
      v_merchant_id, NULL, NULL, ARRAY[v_product_slug, v_product_id::text]
    );
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_cache_from_product_category()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER product_categories_enqueue_cache_invalidation
AFTER INSERT OR DELETE OR UPDATE OF product_id, category_id, is_primary
ON public.product_categories FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_product_category();
