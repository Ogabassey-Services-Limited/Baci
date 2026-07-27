-- Broad work remains claimable first for rollout fairness. A successful exact
-- finish must create a later outer purge, with generation fencing if that broad
-- row was already claimed; failed exact work must not create false completion.
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_merchant uuid := 'f1000000-0000-4000-8000-000000000001';
  v_failure_merchant uuid := 'f1000000-0000-4000-8000-000000000002';
  v_broad_claim record;
  v_exact_claim record;
  v_requeued_claim record;
  v_broad_generation bigint;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug) VALUES
    (v_merchant, 'round7-order@example.com', 'Round Seven Order',
      'round-seven-order'),
    (v_failure_merchant, 'round7-failure@example.com', 'Round Seven Failure',
      'round-seven-failure');

  PERFORM public.enqueue_storefront_cache_targets(v_merchant);
  PERFORM public.enqueue_storefront_product_cache_target(
    v_merchant, 'ready-product'
  );
  UPDATE public.cache_invalidation_outbox
  SET next_attempt_at = pg_catalog.now() + interval '1 hour'
  WHERE merchant_id <> v_merchant;

  SELECT * INTO v_broad_claim
  FROM public.claim_cache_invalidations(1, 'round7-broad-first');
  IF v_broad_claim.claim_token IS NULL
    OR v_broad_claim.target_kind <> 'storefront_slug'
    OR v_broad_claim.target_id <> 'round-seven-order' THEN
    RAISE EXCEPTION 'broad work must remain first for rollout fairness';
  END IF;
  v_broad_generation := v_broad_claim.generation;

  SELECT * INTO v_exact_claim
  FROM public.claim_cache_invalidations(1, 'round7-exact-after-broad');
  IF v_exact_claim.claim_token IS NULL
    OR v_exact_claim.target_kind <> 'storefront_product'
    OR v_exact_claim.target_id <> 'ready-product' THEN
    RAISE EXCEPTION 'exact work must remain claimable after the broad target';
  END IF;
  IF public.finish_cache_invalidation(
    v_exact_claim.merchant_id, v_exact_claim.target_kind,
    v_exact_claim.target_id, v_exact_claim.generation,
    v_exact_claim.claim_token, true, NULL, NULL
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'successful exact finish must be accepted';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant
      AND target_kind = 'storefront_slug'
      AND target_id = 'round-seven-order'
      AND generation = v_broad_generation + 1
      AND status = 'claimed'
  ) THEN
    RAISE EXCEPTION
      'successful exact finish must generation-fence the claimed broad target';
  END IF;

  IF public.finish_cache_invalidation(
    v_broad_claim.merchant_id, v_broad_claim.target_kind,
    v_broad_claim.target_id, v_broad_claim.generation,
    v_broad_claim.claim_token, true, NULL, NULL
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'stale broad finish must be accepted through its claim fence';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant
      AND target_kind = 'storefront_slug'
      AND target_id = 'round-seven-order'
      AND generation = v_broad_generation + 1
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'stale broad finish must leave the later purge pending';
  END IF;

  SELECT * INTO v_requeued_claim
  FROM public.claim_cache_invalidations(1, 'round7-requeued-broad');
  IF v_requeued_claim.claim_token IS NULL
    OR v_requeued_claim.target_kind <> 'storefront_slug'
    OR v_requeued_claim.target_id <> 'round-seven-order'
    OR v_requeued_claim.generation <> v_broad_generation + 1 THEN
    RAISE EXCEPTION 'the post-exact broad purge must be claimable';
  END IF;
  PERFORM public.finish_cache_invalidation(
    v_requeued_claim.merchant_id, v_requeued_claim.target_kind,
    v_requeued_claim.target_id, v_requeued_claim.generation,
    v_requeued_claim.claim_token, true, NULL, NULL
  );

  PERFORM public.enqueue_storefront_cache_targets(v_failure_merchant);
  PERFORM public.enqueue_storefront_product_cache_target(
    v_failure_merchant, 'failed-product'
  );
  UPDATE public.cache_invalidation_outbox
  SET next_attempt_at = pg_catalog.now() + interval '1 hour'
  WHERE merchant_id <> v_failure_merchant;

  SELECT * INTO v_broad_claim
  FROM public.claim_cache_invalidations(1, 'round7-failure-broad');
  PERFORM public.finish_cache_invalidation(
    v_broad_claim.merchant_id, v_broad_claim.target_kind,
    v_broad_claim.target_id, v_broad_claim.generation,
    v_broad_claim.claim_token, true, NULL, NULL
  );
  SELECT generation INTO v_broad_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_failure_merchant
    AND target_kind = 'storefront_slug'
    AND target_id = 'round-seven-failure';

  SELECT * INTO v_exact_claim
  FROM public.claim_cache_invalidations(1, 'round7-failure-exact');
  IF public.finish_cache_invalidation(
    v_exact_claim.merchant_id, v_exact_claim.target_kind,
    v_exact_claim.target_id, v_exact_claim.generation,
    v_exact_claim.claim_token, false, 'vercel_timeout', 30
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'failed exact finish must be accepted';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_failure_merchant
      AND target_kind = 'storefront_slug'
      AND target_id = 'round-seven-failure'
      AND generation = v_broad_generation
      AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'failed exact work must not enqueue a broad purge';
  END IF;
END;
$$;

ROLLBACK;
