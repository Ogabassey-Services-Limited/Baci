-- Regression coverage for fairness and public capability invalidation repairs.
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_merchant uuid := 'd1000000-0000-4000-8000-000000000001';
  v_product uuid := 'd2000000-0000-4000-8000-000000000001';
  v_category uuid := 'd3000000-0000-4000-8000-000000000001';
  v_generation bigint;
  v_product_generation bigint;
  v_claim record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.cache_invalidation_outbox
    WHERE merchant_id = 'a1000000-0000-4000-8000-000000000001'
      AND target_kind = 'storefront_product'
  ) THEN
    RAISE EXCEPTION
      'migration-seeded exact-product backlog must compress to broad work';
  END IF;

  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (v_merchant, 'round5@example.com', 'Round Five', 'round-five');
  PERFORM public.enqueue_storefront_cache_targets(v_merchant);
  PERFORM public.enqueue_storefront_product_cache_target(
    v_merchant, 'round5-product'
  );

  UPDATE public.cache_invalidation_outbox
  SET next_attempt_at = now() + interval '1 hour'
  WHERE merchant_id <> v_merchant;
  SELECT * INTO v_claim
  FROM public.claim_cache_invalidations(1, 'round5-fairness');
  IF v_claim.claim_token IS NULL
    OR v_claim.merchant_id <> v_merchant
    OR v_claim.target_kind <> 'storefront_slug'
    OR v_claim.target_id <> 'round-five' THEN
    RAISE EXCEPTION
      'broad storefront purge must be claimable while exact product work remains';
  END IF;

  PERFORM public.finish_cache_invalidation(
    v_claim.merchant_id, v_claim.target_kind, v_claim.target_id,
    v_claim.generation, v_claim.claim_token, true, NULL, NULL
  );
  SELECT generation INTO v_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
    AND target_id = 'round-five';
  UPDATE public.merchants
  SET paystack_subaccount_code = 'ACCT_round5'
  WHERE id = v_merchant;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'round-five') <> v_generation + 1 THEN
    RAISE EXCEPTION
      'Paystack capability changes must invalidate the storefront cache';
  END IF;

  INSERT INTO public.products (id, merchant_id, name, slug, status)
  VALUES (v_product, v_merchant, 'Round Five Product', 'round5-product', 'active');
  INSERT INTO public.categories (id, merchant_id, name, slug, is_active)
  VALUES (v_category, v_merchant, 'Unknown category', 'unknown-category', NULL);
  SELECT generation INTO v_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
    AND target_id = 'round-five';
  SELECT generation INTO v_product_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_product'
    AND target_id = v_product::text;
  INSERT INTO public.product_categories (product_id, category_id)
  VALUES (v_product, v_category);
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'round-five') <> v_generation
    OR (SELECT generation FROM public.cache_invalidation_outbox
        WHERE merchant_id = v_merchant AND target_kind = 'storefront_product'
          AND target_id = v_product::text) <> v_product_generation THEN
    RAISE EXCEPTION
      'category membership with an absent activity status must be inactive';
  END IF;

  DELETE FROM public.categories WHERE id = v_category;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'round-five') <> v_generation THEN
    RAISE EXCEPTION
      'category deletion with an absent activity status must be inactive';
  END IF;

  PERFORM public.enqueue_cache_invalidation_target(
    v_merchant,
    'storefront_slug',
    'z-target',
    ARRAY(
      SELECT 'a-' || lpad(index::text, 2, '0')
      FROM generate_series(1, 40) AS index
      ORDER BY index
    ),
    '{}'
  );
  IF NOT (
    SELECT related_identifiers @> ARRAY['z-target']
    FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
      AND target_id = 'z-target'
  ) THEN
    RAISE EXCEPTION
      'bounded target normalization must preserve the normalized target id';
  END IF;
END;
$$;

ROLLBACK;
