-- Preserve every exact product invalidation and cover public feature settings.

ALTER TABLE public.cache_invalidation_outbox
  DROP CONSTRAINT cache_invalidation_outbox_target_kind_check;
ALTER TABLE public.cache_invalidation_outbox
  ADD CONSTRAINT cache_invalidation_outbox_target_kind_check CHECK (
    target_kind IN (
      'storefront_slug', 'storefront_hostname', 'storefront_product'
    )
  );
CREATE INDEX cache_invalidation_outbox_product_barrier_idx
  ON public.cache_invalidation_outbox (merchant_id, target_kind)
  WHERE target_kind = 'storefront_product';

CREATE FUNCTION public.enqueue_storefront_product_cache_target(
  p_merchant_id uuid,
  p_product_identifier text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target text := pg_catalog.lower(pg_catalog.btrim(p_product_identifier));
BEGIN
  IF p_merchant_id IS NULL OR v_target IS NULL
    OR pg_catalog.length(v_target) NOT BETWEEN 1 AND 253
    OR v_target !~ '^[a-z0-9](?:[a-z0-9-]{0,251}[a-z0-9])?$'
  THEN RETURN; END IF;

  INSERT INTO public.cache_invalidation_outbox AS outbox (
    merchant_id, target_kind, target_id, related_identifiers, product_slugs
  ) VALUES (
    p_merchant_id, 'storefront_product', v_target, '{}', ARRAY[v_target]
  )
  ON CONFLICT (merchant_id, target_kind, target_id) DO UPDATE
  SET generation = outbox.generation + 1,
      related_identifiers = '{}', product_slugs = excluded.product_slugs,
      status = CASE WHEN outbox.status = 'claimed' THEN 'claimed' ELSE 'pending' END,
      attempts = CASE WHEN outbox.status = 'claimed' THEN outbox.attempts ELSE 0 END,
      next_attempt_at = CASE
        WHEN outbox.status = 'claimed' THEN outbox.next_attempt_at ELSE now() END,
      last_error_code = CASE
        WHEN outbox.status = 'claimed' THEN outbox.last_error_code ELSE NULL END,
      updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_product_cache_target(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

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
DECLARE v_slug text; v_target text;
BEGIN
  SELECT merchant.slug INTO v_slug FROM public.merchants AS merchant
  WHERE merchant.id = p_merchant_id;
  IF v_slug IS NULL THEN RETURN; END IF;

  FOR v_target IN SELECT DISTINCT candidate FROM (
    SELECT v_slug AS candidate UNION ALL SELECT p_additional_slug UNION ALL
    SELECT alias.old_slug FROM public.merchant_slug_aliases AS alias
    WHERE alias.merchant_id = p_merchant_id
  ) AS targets WHERE candidate IS NOT NULL LOOP
    PERFORM public.enqueue_cache_invalidation_target(
      p_merchant_id, 'storefront_slug', v_target,
      ARRAY[v_slug, p_additional_slug, v_target], '{}'
    );
  END LOOP;
  FOR v_target IN SELECT DISTINCT candidate FROM (
    SELECT domain_row.domain AS candidate FROM public.domains AS domain_row
    WHERE domain_row.merchant_id = p_merchant_id
      AND domain_row.status = 'active' AND domain_row.verified_at IS NOT NULL
    UNION ALL SELECT p_additional_hostname
  ) AS targets WHERE candidate IS NOT NULL LOOP
    PERFORM public.enqueue_cache_invalidation_target(
      p_merchant_id, 'storefront_hostname', v_target,
      ARRAY[v_slug, p_additional_slug, v_target], '{}'
    );
  END LOOP;
  FOR v_target IN SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(candidate))
    FROM pg_catalog.unnest(coalesce(p_product_slugs, '{}')) AS candidate
    WHERE candidate IS NOT NULL LOOP
    PERFORM public.enqueue_storefront_product_cache_target(p_merchant_id, v_target);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_cache_targets(
  uuid, text, text, text[]
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.merchant_feature_settings_public_cache_projection(
  p_settings public.merchant_feature_settings
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE v_row jsonb := pg_catalog.to_jsonb(p_settings); v_public jsonb;
BEGIN
  SELECT coalesce(pg_catalog.jsonb_object_agg(entry.key, entry.value), '{}')
  INTO v_public FROM pg_catalog.jsonb_each(v_row) AS entry
  WHERE entry.key = ANY (ARRAY[
    'about_page_enabled','agentic_checkout_enabled','auto_blog_enabled',
    'blog_enabled','blog_discover_image_validation_enabled','checkout_collect_phone',
    'checkout_require_account','checkout_show_order_notes','contact_page_enabled',
    'credpal_enabled','credit_direct_enabled','credit_direct_max_amount',
    'credit_direct_min_amount','discount_codes_enabled','faq_page_enabled',
    'facebook_pixel_id','free_shipping_threshold','google_analytics_id',
    'google_place_id','google_reviews_enabled','guest_checkout_enabled',
    'juicyway_enabled','klump_enabled','klump_max_amount','klump_min_amount',
    'korapay_enabled','loyalty_enabled','low_stock_threshold',
    'order_tracking_enabled','pay_on_delivery_enabled','paystack_enabled',
    'preferred_international_gateway','preferred_local_gateway',
    'privacy_page_enabled','repairs_catalog_enabled','reviews_enabled',
    'rewards_page_enabled','shipping_insurance_enabled',
    'shipping_insurance_min_order_value','shipping_insurance_opt_in_default',
    'shipping_providers','show_recent_purchases','show_stock_levels',
    'snapchat_pixel_id','terms_page_enabled','tiktok_pixel_id',
    'twitter_pixel_id','vtu_airtime_enabled','vtu_checkout_addon_amounts',
    'vtu_checkout_addon_enabled','vtu_data_enabled','vtu_electricity_enabled',
    'vtu_enabled','vtu_loyalty_reward_enabled','vtu_tv_enabled',
    'wallet_order_auto_debit_enabled','wallet_paystack_dva_enabled',
    'customer_device_savings_enabled','customer_device_savings_auto_debit_enabled',
    'customer_device_savings_break_fee_enabled','wishlist_enabled'
  ]);
  RETURN v_public || pg_catalog.jsonb_build_object(
    'custom_settings', pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'google_merchant_id', v_row->'custom_settings'->'google_merchant_id',
      'google_store_widget_enabled',
        v_row->'custom_settings'->'google_store_widget_enabled',
      'paypal_enabled', v_row->'custom_settings'->'paypal_enabled',
      'paypal_mode', v_row->'custom_settings'->'paypal_mode'
    ))
  );
END;
$$;
REVOKE ALL ON FUNCTION public.merchant_feature_settings_public_cache_projection(
  public.merchant_feature_settings
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.enqueue_storefront_cache_from_feature_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.merchant_id IS NOT DISTINCT FROM NEW.merchant_id
    AND public.merchant_feature_settings_public_cache_projection(OLD)
      IS NOT DISTINCT FROM
      public.merchant_feature_settings_public_cache_projection(NEW)
  THEN RETURN NEW; END IF;
  IF TG_OP = 'DELETE' OR (
    TG_OP = 'UPDATE' AND OLD.merchant_id IS DISTINCT FROM NEW.merchant_id
  ) THEN
    PERFORM public.enqueue_storefront_cache_targets(OLD.merchant_id);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM public.enqueue_storefront_cache_targets(NEW.merchant_id);
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_cache_from_feature_settings()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER merchant_feature_settings_enqueue_cache_invalidation
AFTER INSERT OR UPDATE OR DELETE ON public.merchant_feature_settings
FOR EACH ROW EXECUTE FUNCTION public.enqueue_storefront_cache_from_feature_settings();

CREATE OR REPLACE FUNCTION public.claim_cache_invalidations(
  p_batch_size integer DEFAULT 5,
  p_worker_id text DEFAULT 'cache-invalidation-cron'
)
RETURNS TABLE (merchant_id uuid, target_kind text, target_id text,
  related_identifiers text[], product_slugs text[], generation bigint,
  claim_token uuid, attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_batch_size integer := greatest(1, least(coalesce(p_batch_size, 5), 5));
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.cache_invalidation_outbox AS outbox
  WHERE outbox.target_kind = 'storefront_product'
    AND outbox.status = 'completed'
    AND outbox.completed_generation = outbox.generation;
  UPDATE public.cache_invalidation_outbox AS outbox
  SET status = 'pending', attempts = 0, next_attempt_at = now(),
      claim_token = NULL, claimed_by = NULL, claimed_at = NULL,
      last_error_code = NULL, updated_at = now()
  WHERE outbox.status = 'claimed' AND outbox.generation > outbox.claimed_generation
    AND outbox.claimed_at < now() - interval '2 minutes';
  UPDATE public.cache_invalidation_outbox AS outbox
  SET status = 'dead_letter', claim_token = NULL, claimed_by = NULL,
      claimed_at = NULL, updated_at = now()
  WHERE outbox.status = 'claimed' AND outbox.generation = outbox.claimed_generation
    AND outbox.attempts >= outbox.max_attempts
    AND outbox.claimed_at < now() - interval '2 minutes';

  RETURN QUERY WITH candidates AS MATERIALIZED (
    SELECT outbox.merchant_id, outbox.target_kind, outbox.target_id
    FROM public.cache_invalidation_outbox AS outbox
    WHERE outbox.attempts < outbox.max_attempts AND (
      (outbox.status IN ('pending', 'failed') AND outbox.next_attempt_at <= now())
      OR (outbox.status = 'claimed' AND outbox.claimed_at < now() - interval '2 minutes')
    ) AND (outbox.target_kind = 'storefront_product' OR NOT EXISTS (
      SELECT 1 FROM public.cache_invalidation_outbox AS product_target
      WHERE product_target.merchant_id = outbox.merchant_id
        AND product_target.target_kind = 'storefront_product'
    ))
    ORDER BY (outbox.target_kind = 'storefront_product') DESC,
      outbox.next_attempt_at, outbox.updated_at
    LIMIT v_batch_size FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.cache_invalidation_outbox AS outbox
    SET status = 'claimed', claim_token = gen_random_uuid(),
      claimed_generation = outbox.generation,
      claimed_by = left(coalesce(nullif(btrim(p_worker_id), ''),
        'cache-invalidation-cron'), 100),
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
GRANT EXECUTE ON FUNCTION public.claim_cache_invalidations(integer, text)
  TO service_role;

SELECT public.enqueue_storefront_cache_targets(product.merchant_id)
FROM (
  SELECT DISTINCT merchant_id
  FROM public.products
  WHERE status = 'active'
) AS product;
SELECT public.enqueue_storefront_product_cache_target(
  product.merchant_id, identifier.identifier
)
FROM public.products AS product
CROSS JOIN LATERAL pg_catalog.unnest(
  ARRAY[product.slug, product.id::text]
) AS identifier(identifier)
WHERE product.status = 'active' AND identifier.identifier IS NOT NULL;
SELECT public.enqueue_storefront_product_cache_target(
  outbox.merchant_id, identifier.identifier
)
FROM public.cache_invalidation_outbox AS outbox
CROSS JOIN LATERAL pg_catalog.unnest(outbox.product_slugs)
  AS identifier(identifier)
WHERE outbox.target_kind <> 'storefront_product';
