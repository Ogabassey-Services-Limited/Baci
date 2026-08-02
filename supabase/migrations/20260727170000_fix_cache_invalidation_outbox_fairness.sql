-- Correct exact-target fairness and public storefront capability coverage.
-- Earlier cache invalidation migrations remain immutable.

CREATE OR REPLACE FUNCTION public.enqueue_cache_invalidation_target(
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
  v_target_id text := pg_catalog.lower(pg_catalog.btrim(p_target_id));
  v_related_identifiers text[];
  v_product_slugs text[];
BEGIN
  IF p_merchant_id IS NULL
    OR p_target_kind NOT IN ('storefront_slug', 'storefront_hostname')
    OR v_target_id IS NULL
    OR pg_catalog.length(v_target_id) NOT BETWEEN 1 AND 253
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
    SELECT v_target_id AS value
    UNION ALL
    SELECT normalized.value
    FROM (
      SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(candidate)) AS value
      FROM pg_catalog.unnest(coalesce(p_related_identifiers, '{}')) AS candidate
      WHERE candidate IS NOT NULL
        AND pg_catalog.length(pg_catalog.btrim(candidate)) BETWEEN 1 AND 253
        AND pg_catalog.lower(pg_catalog.btrim(candidate)) <> v_target_id
      ORDER BY value
      LIMIT 39
    ) AS normalized
  ) AS preserved;

  SELECT coalesce(array_agg(value ORDER BY value), '{}')
  INTO v_product_slugs
  FROM (
    SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(candidate)) AS value
    FROM pg_catalog.unnest(coalesce(p_product_slugs, '{}')) AS candidate
    WHERE candidate IS NOT NULL
      AND pg_catalog.length(pg_catalog.btrim(candidate)) BETWEEN 1 AND 253
    ORDER BY value
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
          FROM (
            SELECT DISTINCT value
            FROM pg_catalog.unnest(
              outbox.product_slugs || excluded.product_slugs
            ) AS value
            ORDER BY value
            LIMIT 100
          ) AS combined
        ) END,
      status = CASE WHEN outbox.status = 'claimed' THEN 'claimed' ELSE 'pending' END,
      attempts = CASE WHEN outbox.status = 'claimed' THEN outbox.attempts ELSE 0 END,
      next_attempt_at = CASE
        WHEN outbox.status = 'claimed' THEN outbox.next_attempt_at
        ELSE pg_catalog.now()
      END,
      last_error_code = CASE
        WHEN outbox.status = 'claimed' THEN outbox.last_error_code ELSE NULL
      END,
      updated_at = pg_catalog.now();
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_cache_invalidation_target(
  uuid, text, text, text[], text[]
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_cache_invalidations(
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

  DELETE FROM public.cache_invalidation_outbox AS outbox
  WHERE outbox.target_kind = 'storefront_product'
    AND outbox.status = 'completed'
    AND outbox.completed_generation = outbox.generation;

  UPDATE public.cache_invalidation_outbox AS outbox
  SET status = 'pending', attempts = 0, next_attempt_at = pg_catalog.now(),
      claim_token = NULL, claimed_by = NULL, claimed_at = NULL,
      last_error_code = NULL, updated_at = pg_catalog.now()
  WHERE outbox.status = 'claimed'
    AND outbox.generation > outbox.claimed_generation
    AND outbox.claimed_at < pg_catalog.now() - interval '2 minutes';

  UPDATE public.cache_invalidation_outbox AS outbox
  SET status = 'dead_letter', claim_token = NULL, claimed_by = NULL,
      claimed_at = NULL, updated_at = pg_catalog.now()
  WHERE outbox.status = 'claimed'
    AND outbox.generation = outbox.claimed_generation
    AND outbox.attempts >= outbox.max_attempts
    AND outbox.claimed_at < pg_catalog.now() - interval '2 minutes';

  RETURN QUERY WITH candidates AS MATERIALIZED (
    SELECT outbox.merchant_id, outbox.target_kind, outbox.target_id
    FROM public.cache_invalidation_outbox AS outbox
    WHERE outbox.attempts < outbox.max_attempts
      AND (
        (outbox.status IN ('pending', 'failed')
          AND outbox.next_attempt_at <= pg_catalog.now())
        OR (outbox.status = 'claimed'
          AND outbox.claimed_at < pg_catalog.now() - interval '2 minutes')
      )
      AND (
        outbox.target_kind = 'storefront_product'
        OR NOT EXISTS (
          SELECT 1
          FROM public.cache_invalidation_outbox AS product_target
          WHERE product_target.merchant_id = outbox.merchant_id
            AND product_target.target_kind = 'storefront_product'
            AND product_target.status = 'dead_letter'
        )
      )
    ORDER BY
      CASE WHEN outbox.target_kind = 'storefront_product' THEN 1 ELSE 0 END,
      outbox.next_attempt_at, outbox.updated_at
    LIMIT v_batch_size
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.cache_invalidation_outbox AS outbox
    SET status = 'claimed', claim_token = gen_random_uuid(),
      claimed_generation = outbox.generation,
      claimed_by = pg_catalog.left(coalesce(
        nullif(pg_catalog.btrim(p_worker_id), ''),
        'cache-invalidation-cron'
      ), 100),
      claimed_at = pg_catalog.now(), attempts = outbox.attempts + 1,
      updated_at = pg_catalog.now()
    FROM candidates
    WHERE outbox.merchant_id = candidates.merchant_id
      AND outbox.target_kind = candidates.target_kind
      AND outbox.target_id = candidates.target_id
    RETURNING outbox.merchant_id, outbox.target_kind, outbox.target_id,
      outbox.related_identifiers, outbox.product_slugs,
      outbox.claimed_generation, outbox.claim_token, outbox.attempts
  )
  SELECT claimed.merchant_id, claimed.target_kind, claimed.target_id,
    claimed.related_identifiers, claimed.product_slugs,
    claimed.claimed_generation, claimed.claim_token, claimed.attempts
  FROM claimed;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_cache_invalidations(integer, text)
  FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.claim_cache_invalidations(integer, text)
  TO service_role;

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
  gmc_variants_enabled, paystack_subaccount_code
ON public.merchants FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_merchant();

CREATE OR REPLACE FUNCTION public.enqueue_storefront_cache_from_tenant_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE pg_catalog.to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE pg_catalog.to_jsonb(NEW) END;
BEGIN
  IF TG_TABLE_NAME = 'categories' AND NOT (
    coalesce((v_old->>'is_active')::boolean, false)
    OR coalesce((v_new->>'is_active')::boolean, false)
  ) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_TABLE_NAME = 'products' THEN
    IF NOT (
      coalesce(v_old->>'status' = 'active', false)
      OR coalesce(v_new->>'status' = 'active', false)
    ) THEN
      RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    IF TG_OP = 'UPDATE'
      AND (v_old - 'stock' - 'stock_quantity' - 'updated_at')
        IS NOT DISTINCT FROM (v_new - 'stock' - 'stock_quantity' - 'updated_at')
      AND (
        v_old->'stock' IS DISTINCT FROM v_new->'stock'
        OR v_old->'stock_quantity' IS DISTINCT FROM v_new->'stock_quantity'
      )
      AND NOT (
        coalesce((v_old->>'manage_stock')::boolean, false)
        OR coalesce((v_new->>'manage_stock')::boolean, false)
      )
    THEN
      RETURN NEW;
    END IF;
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

CREATE OR REPLACE FUNCTION public.enqueue_storefront_cache_from_product_category()
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
        AND coalesce(category.is_active, false)
      WHERE product.status = 'active'
    )
    SELECT candidate.merchant_id,
      coalesce(
        array_agg(DISTINCT product_identifier)
          FILTER (WHERE product_identifier IS NOT NULL),
        '{}'::text[]
      ) AS product_identifiers
    FROM candidates AS candidate
    CROSS JOIN LATERAL pg_catalog.unnest(
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

-- Future cross-tenant membership attempts fail closed at write time. Lock both
-- owners while comparing them so a concurrent tenant reassignment cannot turn
-- a valid edge into a cross-tenant one after validation; no memberships are
-- deleted as part of this prospective repair.
CREATE OR REPLACE FUNCTION public.validate_product_category_merchant_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product_merchant_id uuid;
  v_category_merchant_id uuid;
BEGIN
  SELECT product.merchant_id
  INTO v_product_merchant_id
  FROM public.products AS product
  WHERE product.id = NEW.product_id
  FOR UPDATE;

  SELECT category.merchant_id
  INTO v_category_merchant_id
  FROM public.categories AS category
  WHERE category.id = NEW.category_id
  FOR UPDATE;

  IF v_product_merchant_id IS NULL
    OR v_category_merchant_id IS NULL
    OR v_product_merchant_id IS DISTINCT FROM v_category_merchant_id
  THEN
    RAISE EXCEPTION 'product and category must belong to the same merchant'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_product_category_merchant_match()
  FROM PUBLIC, anon, authenticated, service_role;

-- The preceding exact-target migration seeds every active product. Replacing
-- unclaimed, first-attempt rows with one broad target per merchant is a safe
-- superset invalidation and keeps the initial worker queue bounded. Claimed,
-- failed, and terminal exact work is retained for its existing lifecycle.
WITH compressed_exact_targets AS (
  DELETE FROM public.cache_invalidation_outbox AS outbox
  WHERE outbox.target_kind = 'storefront_product'
    AND outbox.status = 'pending'
    AND outbox.attempts = 0
    AND outbox.claim_token IS NULL
    AND outbox.claimed_generation IS NULL
    AND outbox.claimed_by IS NULL
    AND outbox.claimed_at IS NULL
  RETURNING outbox.merchant_id
)
SELECT public.enqueue_storefront_cache_targets(target.merchant_id)
FROM (
  SELECT DISTINCT merchant_id
  FROM compressed_exact_targets
) AS target;
