-- Regression coverage for the ordered cache-invalidation outbox.
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_merchant uuid := '71000000-0000-4000-8000-000000000001';
  v_second_merchant uuid := '71000000-0000-4000-8000-000000000002';
  v_product uuid := '72000000-0000-4000-8000-000000000001';
  v_second_product uuid := '72000000-0000-4000-8000-000000000002';
  v_variant uuid := '74000000-0000-4000-8000-000000000001';
  v_claim record;
  v_completed boolean;
  v_generation bigint;
  v_old_generation bigint;
  v_new_generation bigint;
  v_next_attempt timestamptz;
  v_status text;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (v_merchant, 'cache@example.com', 'Cache Store', 'cache-store');
  INSERT INTO public.domains (
    id, merchant_id, domain, domain_type, status, verified_at
  ) VALUES (
    '73000000-0000-4000-8000-000000000001', v_merchant,
    'cache.example.com', 'custom', 'active', now()
  );
  INSERT INTO public.products (
    id, merchant_id, name, price, slug, status, manage_stock, stock_quantity
  ) VALUES (
    v_product, v_merchant, 'Cache Phone', 100, 'cache-phone', 'active', true, 2
  );
  UPDATE public.products SET images = '["phone.jpg"]'::jsonb WHERE id = v_product;

  IF NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
      AND target_id = 'cache-store' AND generation = 3
  ) OR NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_kind = 'storefront_hostname'
      AND target_id = 'cache.example.com' AND generation = 3
  ) THEN
    RAISE EXCEPTION 'mutation targets must coalesce by immutable tenant target';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_id = 'cache.example.com'
      AND related_identifiers @> ARRAY['cache-store', 'cache.example.com']
  ) OR NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_kind = 'storefront_product'
      AND target_id = 'cache-phone' AND product_slugs = ARRAY['cache-phone']
  ) OR NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_kind = 'storefront_product'
      AND target_id = v_product::text AND product_slugs = ARRAY[v_product::text]
  ) THEN
    RAISE EXCEPTION 'each target must carry independently drainable identity snapshots';
  END IF;
  SELECT generation INTO v_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_id = 'cache-store';
  UPDATE public.products SET condition = 'used' WHERE id = v_product;
  IF NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_id = 'cache-store'
      AND generation = v_generation + 1
  ) THEN
    RAISE EXCEPTION 'customer-visible product condition must enqueue';
  END IF;
  SELECT generation INTO v_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_id = 'cache-store';
  UPDATE public.merchants SET site_title = 'New public title' WHERE id = v_merchant;
  IF NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_id = 'cache-store'
      AND generation = v_generation + 1
  ) THEN
    RAISE EXCEPTION 'customer-visible merchant fields must enqueue';
  END IF;

  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (v_second_merchant, 'cache-two@example.com', 'Cache Two', 'cache-two');
  INSERT INTO public.products (
    id, merchant_id, name, price, slug, status, manage_stock, stock_quantity
  ) VALUES (
    v_second_product, v_second_merchant, 'Second Phone', 200,
    'second-phone', 'active', true, 1
  );
  INSERT INTO public.product_variants (id, merchant_id, product_id, sku, stock_quantity)
  VALUES (v_variant, v_merchant, v_product, 'MOVE-1', 1);
  SELECT generation INTO v_old_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
    AND target_id = 'cache-store';
  SELECT generation INTO v_new_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_second_merchant AND target_kind = 'storefront_slug'
    AND target_id = 'cache-two';
  UPDATE public.product_variants SET product_id = v_second_product WHERE id = v_variant;
  IF NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_id = 'cache-store'
      AND generation = v_old_generation + 1
  ) OR NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_second_merchant AND target_id = 'cache-two'
      AND generation = v_new_generation + 1
  ) THEN
    RAISE EXCEPTION 'variant reassignment must enqueue source and destination tenants';
  END IF;
  UPDATE public.products SET manage_stock = false WHERE id = v_second_product;
  SELECT generation INTO v_new_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_second_merchant AND target_id = 'cache-two';
  UPDATE public.products SET stock_quantity = 99 WHERE id = v_second_product;
  IF NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_second_merchant AND target_id = 'cache-two'
      AND generation = v_new_generation
  ) THEN
    RAISE EXCEPTION 'unlimited-stock quantity-only changes must not enqueue';
  END IF;

  UPDATE public.merchants SET slug = 'cache-store-new' WHERE id = v_merchant;
  DELETE FROM public.domains WHERE merchant_id = v_merchant;
  IF NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
      AND target_id IN ('cache-store', 'cache-store-new')
    GROUP BY merchant_id HAVING count(*) = 2
  ) OR NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_kind = 'storefront_hostname'
      AND target_id = 'cache.example.com'
  ) THEN
    RAISE EXCEPTION 'rename and domain removal must preserve old and new targets';
  END IF;

  UPDATE public.cache_invalidation_outbox
  SET status = CASE WHEN target_id = 'cache-store-new' THEN 'pending' ELSE 'completed' END,
      next_attempt_at = now();
  SELECT * INTO v_claim FROM public.claim_cache_invalidations(1, 'sql-worker');
  IF v_claim.claim_token IS NULL
    OR v_claim.target_id <> 'cache-store-new' OR v_claim.attempts <> 1 THEN
    RAISE EXCEPTION 'claim must select one due immutable target: %', v_claim;
  END IF;
  IF NOT (v_claim.related_identifiers @> ARRAY['cache-store-new']) THEN
    RAISE EXCEPTION 'claim must include bounded identity snapshots: %', v_claim;
  END IF;
  SELECT public.finish_cache_invalidation(
    v_claim.merchant_id, v_claim.target_kind, v_claim.target_id,
    v_claim.generation, gen_random_uuid(), true, NULL, NULL
  ) INTO v_completed;
  IF v_completed IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'mismatched claim token must not complete work';
  END IF;

  UPDATE public.products SET meta_title = 'new generation' WHERE id = v_product;
  SELECT generation INTO v_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = v_claim.target_kind
    AND target_id = v_claim.target_id;
  PERFORM public.finish_cache_invalidation(
    v_claim.merchant_id, v_claim.target_kind, v_claim.target_id,
    v_claim.generation, v_claim.claim_token, true, NULL, NULL
  );
  SELECT status INTO v_status FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = v_claim.target_kind
    AND target_id = v_claim.target_id;
  IF v_generation <= v_claim.generation OR v_status <> 'pending' THEN
    RAISE EXCEPTION 'new generation must remain pending after stale completion';
  END IF;

  UPDATE public.cache_invalidation_outbox SET
    status = CASE
      WHEN target_kind = 'storefront_product' AND target_id = 'cache-phone'
        THEN 'pending'
      ELSE 'completed'
    END,
    next_attempt_at = now();
  SELECT * INTO v_claim FROM public.claim_cache_invalidations(1, 'sql-worker');
  IF v_claim.claim_token IS NULL
    OR v_claim.target_kind <> 'storefront_product'
    OR v_claim.target_id <> 'cache-phone'
  THEN
    RAISE EXCEPTION 'expected a due claim before the stale-recovery scenario';
  END IF;
  UPDATE public.products SET meta_title = 'crashed newer generation' WHERE id = v_product;
  UPDATE public.cache_invalidation_outbox
  SET status = 'completed'
  WHERE merchant_id = v_merchant
    AND target_kind = 'storefront_product'
    AND target_id <> v_claim.target_id;
  UPDATE public.cache_invalidation_outbox
  SET attempts = max_attempts, claimed_at = now() - interval '3 minutes'
  WHERE merchant_id = v_merchant AND target_kind = v_claim.target_kind
    AND target_id = v_claim.target_id;
  SELECT * INTO v_claim FROM public.claim_cache_invalidations(1, 'sql-recovery');
  IF v_claim.claim_token IS NULL OR v_claim.attempts <> 1 THEN
    RAISE EXCEPTION 'stale newer generation must receive a fresh retry budget';
  END IF;

  PERFORM public.finish_cache_invalidation(
    v_claim.merchant_id, v_claim.target_kind, v_claim.target_id,
    v_claim.generation, v_claim.claim_token, false, 'cloudflare_request_failed', 120
  );
  SELECT status, next_attempt_at INTO v_status, v_next_attempt
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = v_claim.target_kind
    AND target_id = v_claim.target_id;
  IF v_status <> 'failed'
    OR v_next_attempt < now() + interval '119 seconds'
    OR v_next_attempt > now() + interval '121 seconds'
  THEN
    RAISE EXCEPTION 'Retry-After must bound the next claim time';
  END IF;

  UPDATE public.cache_invalidation_outbox
  SET status = 'dead_letter'
  WHERE merchant_id = v_merchant AND target_id = 'cache.example.com';
  UPDATE public.products SET meta_title = 'unrelated mutation' WHERE id = v_product;
  IF NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_id = 'cache.example.com'
      AND status = 'dead_letter'
  ) THEN
    RAISE EXCEPTION 'unpurged retired dead-letter target must not be discarded';
  END IF;

  DELETE FROM public.merchants WHERE id = v_merchant;
  IF NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox WHERE merchant_id = v_merchant
  ) THEN
    RAISE EXCEPTION 'merchant deletion must preserve immutable tombstone targets';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  BEGIN
    PERFORM public.claim_cache_invalidations(1, 'unauthorized');
    RAISE EXCEPTION 'claim must enforce runtime service role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
END;
$$;

ROLLBACK;
