-- Durable ordered storefront cache invalidation. Mutations enqueue immutable
-- tenant targets transactionally; the authenticated Next cron route drains
-- Next -> Vercel -> Cloudflare before generation-fenced completion.

CREATE TABLE public.cache_invalidation_outbox (
  merchant_id uuid NOT NULL,
  target_kind text NOT NULL CHECK (
    target_kind IN ('storefront_slug', 'storefront_hostname')
  ),
  target_id text NOT NULL CHECK (length(target_id) BETWEEN 1 AND 253),
  related_identifiers text[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(related_identifiers) <= 40
  ),
  product_slugs text[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(product_slugs) <= 100
  ),
  generation bigint NOT NULL DEFAULT 1 CHECK (generation > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'claimed', 'completed', 'failed', 'dead_letter')
  ),
  claim_token uuid,
  claimed_generation bigint,
  claimed_by text,
  claimed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 8 CHECK (max_attempts BETWEEN 1 AND 20),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text CHECK (
    last_error_code IS NULL OR last_error_code ~ '^[a-z0-9_]{1,100}$'
  ),
  completed_generation bigint,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_id, target_kind, target_id)
);

ALTER TABLE public.cache_invalidation_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_invalidation_outbox FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cache_invalidation_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cache_invalidation_outbox TO service_role;
CREATE POLICY cache_invalidation_outbox_service_role
  ON public.cache_invalidation_outbox
  FOR ALL TO service_role
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

CREATE INDEX cache_invalidation_outbox_ready_idx
  ON public.cache_invalidation_outbox (next_attempt_at, updated_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX cache_invalidation_outbox_stale_idx
  ON public.cache_invalidation_outbox (claimed_at)
  WHERE status = 'claimed';

CREATE FUNCTION public.enqueue_cache_invalidation_target(
  p_merchant_id uuid,
  p_target_kind text,
  p_target_id text,
  p_related_identifiers text[] DEFAULT '{}',
  p_product_slugs text[] DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target_id text := lower(btrim(p_target_id));
  v_related_identifiers text[];
  v_product_slugs text[];
BEGIN
  IF p_merchant_id IS NULL
    OR p_target_kind NOT IN ('storefront_slug', 'storefront_hostname')
    OR v_target_id IS NULL
    OR length(v_target_id) NOT BETWEEN 1 AND 253
  THEN
    RETURN;
  END IF;
  IF p_target_kind = 'storefront_slug'
    AND v_target_id !~ '^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$'
  THEN
    RETURN;
  END IF;
  IF p_target_kind = 'storefront_hostname'
    AND v_target_id !~ '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
  THEN
    RETURN;
  END IF;

  SELECT coalesce(array_agg(value ORDER BY value), '{}')
  INTO v_related_identifiers
  FROM (
    SELECT DISTINCT lower(btrim(candidate)) AS value
    FROM unnest(coalesce(p_related_identifiers, '{}') || ARRAY[v_target_id]) AS candidate
    WHERE candidate IS NOT NULL AND length(btrim(candidate)) BETWEEN 1 AND 253
    LIMIT 40
  ) AS normalized;
  SELECT coalesce(array_agg(value ORDER BY value), '{}')
  INTO v_product_slugs
  FROM (
    SELECT DISTINCT lower(btrim(candidate)) AS value
    FROM unnest(coalesce(p_product_slugs, '{}')) AS candidate
    WHERE candidate IS NOT NULL AND length(btrim(candidate)) BETWEEN 1 AND 253
    LIMIT 100
  ) AS normalized;

  INSERT INTO public.cache_invalidation_outbox AS outbox (
    merchant_id, target_kind, target_id, related_identifiers, product_slugs
  ) VALUES (
    p_merchant_id, p_target_kind, v_target_id,
    v_related_identifiers, v_product_slugs
  )
  ON CONFLICT (merchant_id, target_kind, target_id) DO UPDATE
  SET generation = outbox.generation + 1,
      related_identifiers = excluded.related_identifiers,
      product_slugs = CASE WHEN outbox.status = 'completed'
        THEN excluded.product_slugs ELSE (
          SELECT coalesce(array_agg(value ORDER BY value), '{}')
          FROM (SELECT DISTINCT value FROM unnest(
            outbox.product_slugs || excluded.product_slugs
          ) AS value LIMIT 100) AS combined
        ) END,
      status = CASE WHEN outbox.status = 'claimed' THEN 'claimed' ELSE 'pending' END,
      attempts = CASE WHEN outbox.status = 'claimed' THEN outbox.attempts ELSE 0 END,
      next_attempt_at = CASE
        WHEN outbox.status = 'claimed' THEN outbox.next_attempt_at ELSE now()
      END,
      last_error_code = CASE
        WHEN outbox.status = 'claimed' THEN outbox.last_error_code ELSE NULL
      END,
      updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_cache_invalidation_target(
  uuid, text, text, text[], text[]
)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.enqueue_storefront_cache_targets(
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
    FROM unnest(ARRAY[v_slug, p_additional_slug]) AS candidate
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
)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.enqueue_storefront_cache_from_tenant_row()
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
    IF NOT (v_old->>'status' = 'active' OR v_new->>'status' = 'active') THEN
      RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    IF TG_OP = 'UPDATE'
      AND (v_old - 'stock' - 'stock_quantity')
        IS NOT DISTINCT FROM (v_new - 'stock' - 'stock_quantity')
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

CREATE TRIGGER categories_enqueue_cache_invalidation
AFTER INSERT OR DELETE OR UPDATE OF name, slug, description, image_url,
  parent_id, display_order, is_active, buying_guide_url, seo_heading,
  seo_description, seo_features, seo_faq, metadata, merchant_id
ON public.categories FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_tenant_row();

CREATE TRIGGER products_enqueue_cache_invalidation
AFTER INSERT OR DELETE OR UPDATE OF name, slug, description, price,
  compare_at_price, images, color_images, image_hint, status, category,
  category_id, meta_title, meta_description, keywords, canonical_url,
  schema_markup, faqs, specifications, offers, available_conditions,
  condition, has_condition_offers, has_variants, brand, color,
  parent_product_id, default_variant_id, manage_stock,
  inventory_tracking_policy, stock, stock_quantity, merchant_id
ON public.products FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_tenant_row();

CREATE FUNCTION public.enqueue_storefront_cache_from_variant()
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
    SELECT merchant_id, slug INTO v_merchant_id, v_product_slug FROM public.products
    WHERE id = OLD.product_id AND status = 'active';
    PERFORM public.enqueue_storefront_cache_targets(
      v_merchant_id, NULL, NULL, ARRAY[v_product_slug, OLD.product_id::text]
    );
  END IF;
  v_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;
  SELECT merchant_id, coalesce(manage_stock, false), slug
  INTO v_merchant_id, v_manage_stock, v_product_slug FROM public.products
  WHERE id = v_product_id AND status = 'active';
  IF v_merchant_id IS NULL THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
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
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_cache_from_variant()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER product_variants_enqueue_cache_invalidation
AFTER INSERT OR DELETE OR UPDATE OF attributes, condition, images,
  primary_image, price_override, sku, stock_quantity, variant_key,
  inventory_tracking_policy, product_id
ON public.product_variants FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_variant();

CREATE FUNCTION public.enqueue_storefront_cache_from_merchant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.enqueue_storefront_cache_targets(OLD.id, OLD.slug, NULL);
    RETURN OLD;
  END IF;
  PERFORM public.enqueue_storefront_cache_targets(NEW.id, OLD.slug, NULL);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_cache_from_merchant()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER merchants_enqueue_cache_invalidation_on_update
AFTER UPDATE OF slug, is_published, business_name, site_title, site_tagline,
  site_description, business_type, logo_url, phone, email, support_email,
  support_phone, social_media, brand_colors, business_address,
  legal_entity_name, registered_address, tax_identification_number,
  trust_profile, payout_currency, template_id, plan_expires_at, plan_tier,
  premium_features, country, hero_slides, mobile_hero_slides,
  favicon_svg_url, favicon_png_32_url, favicon_png_192_url,
  favicon_apple_touch_url, vat_registration_status, vat_rate,
  feature_settings, published_config, pages, about_page, faq_items
ON public.merchants FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_merchant();
CREATE TRIGGER merchants_enqueue_cache_invalidation_before_delete
BEFORE DELETE ON public.merchants FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_merchant();

CREATE FUNCTION public.enqueue_storefront_cache_from_domain()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_old_hostname text := CASE
    WHEN TG_OP <> 'INSERT' AND OLD.status = 'active' AND OLD.verified_at IS NOT NULL
      THEN OLD.domain ELSE NULL END;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.enqueue_storefront_cache_targets(OLD.merchant_id, NULL, v_old_hostname);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.merchant_id IS DISTINCT FROM NEW.merchant_id THEN
    PERFORM public.enqueue_storefront_cache_targets(OLD.merchant_id, NULL, v_old_hostname);
  END IF;
  PERFORM public.enqueue_storefront_cache_targets(NEW.merchant_id, NULL, v_old_hostname);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_cache_from_domain()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER domains_enqueue_cache_invalidation
AFTER INSERT OR DELETE OR UPDATE OF domain, merchant_id, status, verified_at, is_primary
ON public.domains FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_domain();

CREATE FUNCTION public.claim_cache_invalidations(
  p_batch_size integer DEFAULT 5,
  p_worker_id text DEFAULT 'cache-invalidation-cron'
)
RETURNS TABLE (merchant_id uuid, target_kind text, target_id text,
  related_identifiers text[], product_slugs text[], generation bigint,
  claim_token uuid, attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_batch_size integer := greatest(1, least(coalesce(p_batch_size, 5), 5));
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.cache_invalidation_outbox AS outbox
  SET status = 'pending', attempts = 0, next_attempt_at = now(),
      claim_token = NULL, claimed_by = NULL, claimed_at = NULL,
      last_error_code = NULL, updated_at = now()
  WHERE outbox.status = 'claimed'
    AND outbox.generation > outbox.claimed_generation
    AND outbox.claimed_at < now() - interval '2 minutes';
  UPDATE public.cache_invalidation_outbox AS outbox
  SET status = 'dead_letter', claim_token = NULL, claimed_by = NULL,
      claimed_at = NULL, updated_at = now()
  WHERE outbox.status = 'claimed'
    AND outbox.generation = outbox.claimed_generation
    AND outbox.attempts >= outbox.max_attempts
    AND outbox.claimed_at < now() - interval '2 minutes';

  RETURN QUERY WITH candidates AS MATERIALIZED (
    SELECT outbox.merchant_id, outbox.target_kind, outbox.target_id
    FROM public.cache_invalidation_outbox AS outbox
    WHERE outbox.attempts < outbox.max_attempts AND (
      (outbox.status IN ('pending', 'failed') AND outbox.next_attempt_at <= now())
      OR (outbox.status = 'claimed' AND outbox.claimed_at < now() - interval '2 minutes')
    )
    ORDER BY outbox.next_attempt_at, outbox.updated_at
    LIMIT v_batch_size FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.cache_invalidation_outbox AS outbox
    SET status = 'claimed', claim_token = gen_random_uuid(),
      claimed_generation = outbox.generation,
      claimed_by = left(coalesce(nullif(btrim(p_worker_id), ''), 'cache-invalidation-cron'), 100),
      claimed_at = now(), attempts = outbox.attempts + 1, updated_at = now()
    FROM candidates WHERE outbox.merchant_id = candidates.merchant_id
      AND outbox.target_kind = candidates.target_kind
      AND outbox.target_id = candidates.target_id
    RETURNING outbox.merchant_id, outbox.target_kind, outbox.target_id,
      outbox.related_identifiers, outbox.product_slugs,
      outbox.claimed_generation, outbox.claim_token, outbox.attempts
  ) SELECT claimed.merchant_id, claimed.target_kind, claimed.target_id,
      claimed.related_identifiers, claimed.product_slugs,
      claimed.claimed_generation, claimed.claim_token, claimed.attempts FROM claimed;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_cache_invalidations(integer, text)
  FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.claim_cache_invalidations(integer, text) TO service_role;

CREATE FUNCTION public.finish_cache_invalidation(
  p_merchant_id uuid, p_target_kind text, p_target_id text,
  p_generation bigint, p_claim_token uuid, p_succeeded boolean,
  p_error_code text DEFAULT NULL, p_retry_after_seconds integer DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_updated uuid;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.cache_invalidation_outbox AS outbox SET
    status = CASE WHEN generation > p_generation THEN 'pending'
      WHEN p_succeeded THEN 'completed'
      WHEN attempts >= max_attempts THEN 'dead_letter' ELSE 'failed' END,
    attempts = CASE WHEN generation > p_generation OR p_succeeded THEN 0 ELSE attempts END,
    next_attempt_at = CASE WHEN generation > p_generation THEN now()
      WHEN p_succeeded OR attempts >= max_attempts THEN next_attempt_at
      ELSE now() + make_interval(secs => greatest(
        least(900, (15 * power(2, greatest(attempts - 1, 0)))::integer),
        least(3600, greatest(coalesce(p_retry_after_seconds, 0), 0))
      )) END,
    last_error_code = CASE WHEN generation > p_generation OR p_succeeded THEN NULL
      WHEN coalesce(p_error_code, '') ~ '^[a-z0-9_]{1,100}$' THEN p_error_code
      ELSE 'unknown_failure' END,
    completed_generation = CASE WHEN p_succeeded THEN p_generation ELSE completed_generation END,
    completed_at = CASE WHEN p_succeeded THEN now() ELSE completed_at END,
    claim_token = NULL, claimed_by = NULL, claimed_at = NULL, updated_at = now()
  WHERE merchant_id = p_merchant_id AND target_kind = p_target_kind
    AND target_id = p_target_id AND status = 'claimed'
    AND claimed_generation = p_generation AND claim_token = p_claim_token
  RETURNING merchant_id INTO v_updated;
  RETURN v_updated IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_cache_invalidation(
  uuid, text, text, bigint, uuid, boolean, text, integer
) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.finish_cache_invalidation(
  uuid, text, text, bigint, uuid, boolean, text, integer
) TO service_role;
