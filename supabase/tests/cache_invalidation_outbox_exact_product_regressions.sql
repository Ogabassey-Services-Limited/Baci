-- Exact regressions for no-loss product targets and public feature settings.
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_merchant uuid := 'b1000000-0000-4000-8000-000000000001';
  v_barrier_merchant uuid := 'c1000000-0000-4000-8000-000000000001';
  v_product uuid;
  v_generation bigint;
  v_claim record;
  v_claim_two record;
  v_finished boolean;
  v_status text;
  v_index integer;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (v_merchant, 'exact@example.com', 'Exact Store', 'exact-store');
  PERFORM public.enqueue_storefront_cache_targets(v_merchant);

  SELECT generation INTO v_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
    AND target_id = 'exact-store';
  INSERT INTO public.merchant_feature_settings (
    merchant_id, wishlist_enabled, facebook_capi_token
  ) VALUES (v_merchant, true, 'private-one');
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'exact-store') <> v_generation + 1 THEN
    RAISE EXCEPTION 'feature settings INSERT must enqueue public invalidation';
  END IF;

  SELECT generation INTO v_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
    AND target_id = 'exact-store';
  UPDATE public.merchant_feature_settings
  SET facebook_capi_token = 'private-two' WHERE merchant_id = v_merchant;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'exact-store') <> v_generation THEN
    RAISE EXCEPTION 'private-only feature update must not enqueue';
  END IF;

  UPDATE public.merchant_feature_settings
  SET wishlist_enabled = false WHERE merchant_id = v_merchant;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'exact-store') <> v_generation + 1 THEN
    RAISE EXCEPTION 'public feature update must enqueue';
  END IF;

  SELECT generation INTO v_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
    AND target_id = 'exact-store';
  UPDATE public.merchant_feature_settings
  SET custom_settings = '{"zoho_campaign_secret":"private"}'::jsonb
  WHERE merchant_id = v_merchant;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'exact-store') <> v_generation THEN
    RAISE EXCEPTION 'private custom setting must not enqueue';
  END IF;
  UPDATE public.merchant_feature_settings
  SET custom_settings = custom_settings || '{"paypal_enabled":true}'::jsonb
  WHERE merchant_id = v_merchant;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'exact-store') <> v_generation + 1 THEN
    RAISE EXCEPTION 'public custom setting must enqueue';
  END IF;

  DELETE FROM public.merchant_feature_settings WHERE merchant_id = v_merchant;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'exact-store') <> v_generation + 2 THEN
    RAISE EXCEPTION 'feature settings DELETE must enqueue';
  END IF;

  INSERT INTO public.products (id, merchant_id, name, slug, status)
  SELECT gen_random_uuid(), v_merchant, 'Bulk ' || index,
    'bulk-product-' || lpad(index::text, 3, '0'), 'active'
  FROM generate_series(1, 125) AS index;
  IF (SELECT count(*) FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant
        AND target_kind = 'storefront_product') <> 250 THEN
    RAISE EXCEPTION '125 products must retain all 250 slug and id targets';
  END IF;
  IF (SELECT count(*) FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_product'
        AND target_id LIKE 'bulk-product-%') <> 125 THEN
    RAISE EXCEPTION 'bulk enqueue lost one or more exact product slugs';
  END IF;

  SELECT id INTO v_product FROM public.products
  WHERE merchant_id = v_merchant AND slug = 'bulk-product-001';
  UPDATE public.products SET slug = 'renamed-product'
  WHERE id = v_product;
  IF NOT EXISTS (SELECT 1 FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_product'
        AND target_id = 'bulk-product-001')
    OR NOT EXISTS (SELECT 1 FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_product'
        AND target_id = 'renamed-product') THEN
    RAISE EXCEPTION 'rename must retain old and new exact slug snapshots';
  END IF;

  UPDATE public.cache_invalidation_outbox
  SET next_attempt_at = now() + interval '1 hour'
  WHERE NOT (merchant_id = v_merchant
    AND target_kind = 'storefront_product'
    AND target_id = 'renamed-product');
  SELECT * INTO v_claim FROM public.claim_cache_invalidations(1, 'exact-worker');
  IF v_claim.claim_token IS NULL
    OR v_claim.target_kind <> 'storefront_product'
    OR v_claim.target_id <> 'renamed-product' THEN
    RAISE EXCEPTION 'exact product target must be independently claimable';
  END IF;

  UPDATE public.products SET price = 1 WHERE id = v_product;
  v_finished := public.finish_cache_invalidation(
    v_claim.merchant_id, v_claim.target_kind, v_claim.target_id,
    v_claim.generation, v_claim.claim_token, true, NULL, NULL
  );
  SELECT status INTO v_status FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_product'
    AND target_id = 'renamed-product';
  IF NOT coalesce(v_finished, false) OR v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'product generation fence failed: finished %, status %',
      v_finished, v_status;
  END IF;

  UPDATE public.cache_invalidation_outbox
  SET next_attempt_at = now() + interval '1 hour'
  WHERE NOT (merchant_id = v_merchant
    AND target_kind = 'storefront_product'
    AND target_id = 'renamed-product');
  SELECT * INTO v_claim FROM public.claim_cache_invalidations(1, 'retry-worker');
  IF v_claim.claim_token IS NULL
    OR v_claim.target_kind <> 'storefront_product'
    OR v_claim.target_id <> 'renamed-product' THEN
    RAISE EXCEPTION 'retry claim must retain exact product identity';
  END IF;
  v_finished := public.finish_cache_invalidation(
    v_claim.merchant_id, v_claim.target_kind, v_claim.target_id,
    v_claim.generation, v_claim.claim_token, false, 'vercel_timeout', 1
  );
  SELECT status INTO v_status FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_product'
    AND target_id = 'renamed-product';
  IF NOT coalesce(v_finished, false) OR v_status IS DISTINCT FROM 'failed' THEN
    RAISE EXCEPTION 'product retry failed: finished %, status %',
      v_finished, v_status;
  END IF;

  UPDATE public.cache_invalidation_outbox SET next_attempt_at = now()
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_product'
    AND target_id = 'renamed-product';
  SELECT * INTO v_claim FROM public.claim_cache_invalidations(1, 'retry-worker');
  IF v_claim.claim_token IS NULL
    OR v_claim.target_kind <> 'storefront_product'
    OR v_claim.target_id <> 'renamed-product' THEN
    RAISE EXCEPTION 'successful retry must retain exact product identity';
  END IF;
  v_finished := public.finish_cache_invalidation(
    v_claim.merchant_id, v_claim.target_kind, v_claim.target_id,
    v_claim.generation, v_claim.claim_token, true, NULL, NULL
  );
  PERFORM public.claim_cache_invalidations(1, 'cleanup-worker');
  IF NOT coalesce(v_finished, false) OR EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_product'
        AND target_id = 'renamed-product') THEN
    RAISE EXCEPTION 'completed product target must be safely retired';
  END IF;

  DELETE FROM public.products WHERE id = v_product;
  IF NOT EXISTS (SELECT 1 FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_product'
        AND target_id = 'renamed-product') THEN
    RAISE EXCEPTION 'delete must enqueue the final exact slug snapshot';
  END IF;

  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (v_barrier_merchant, 'barrier@example.com', 'Barrier', 'barrier');
  PERFORM public.enqueue_storefront_cache_targets(v_barrier_merchant);
  FOR v_index IN 1..101 LOOP
    PERFORM public.enqueue_storefront_product_cache_target(
      v_barrier_merchant, 'barrier-product-' || lpad(v_index::text, 3, '0')
    );
  END LOOP;
  UPDATE public.cache_invalidation_outbox
  SET next_attempt_at = now() + interval '1 hour'
  WHERE merchant_id <> v_barrier_merchant;

  SELECT * INTO v_claim
  FROM public.claim_cache_invalidations(1, 'barrier-worker-one');
  SELECT * INTO v_claim_two
  FROM public.claim_cache_invalidations(1, 'barrier-worker-two');
  IF v_claim.claim_token IS NULL
    OR v_claim_two.claim_token IS NULL
    OR v_claim.target_kind <> 'storefront_slug'
    OR v_claim_two.target_kind <> 'storefront_product'
    OR v_claim.claim_token IS NOT DISTINCT FROM v_claim_two.claim_token THEN
    RAISE EXCEPTION 'broad purge must not wait behind exact product work';
  END IF;
  PERFORM public.finish_cache_invalidation(
    v_claim.merchant_id, v_claim.target_kind, v_claim.target_id,
    v_claim.generation, v_claim.claim_token, true, NULL, NULL
  );
  PERFORM public.finish_cache_invalidation(
    v_claim_two.merchant_id, v_claim_two.target_kind, v_claim_two.target_id,
    v_claim_two.generation, v_claim_two.claim_token, true, NULL, NULL
  );

  PERFORM public.enqueue_storefront_product_cache_target(
    v_barrier_merchant, 'blocked-product'
  );
  UPDATE public.cache_invalidation_outbox
  SET next_attempt_at = now() + interval '1 hour'
  WHERE merchant_id = v_barrier_merchant
    AND target_kind = 'storefront_product' AND target_id <> 'blocked-product';
  UPDATE public.cache_invalidation_outbox
  SET status = 'dead_letter', attempts = max_attempts
  WHERE merchant_id = v_barrier_merchant
    AND target_kind = 'storefront_product' AND target_id = 'blocked-product';
  PERFORM public.enqueue_storefront_cache_targets(v_barrier_merchant);
  SELECT * INTO v_claim
  FROM public.claim_cache_invalidations(1, 'barrier-dead-letter');
  IF v_claim.merchant_id IS NOT NULL THEN
    RAISE EXCEPTION 'dead-letter exact product must block the broad purge';
  END IF;
END;
$$;

ROLLBACK;
