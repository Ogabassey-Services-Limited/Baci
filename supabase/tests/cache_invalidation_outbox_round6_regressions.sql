-- Independent storefront product relation writes must invalidate durable cache targets.
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_merchant uuid := 'e1000000-0000-4000-8000-000000000001';
  v_product uuid := 'e2000000-0000-4000-8000-000000000001';
  v_draft uuid := 'e2000000-0000-4000-8000-000000000002';
  v_offer uuid := 'e3000000-0000-4000-8000-000000000001';
  v_generation bigint;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (v_merchant, 'round6@example.com', 'Round Six', 'round-six');
  INSERT INTO public.products (id, merchant_id, name, slug, status)
  VALUES
    (v_product, v_merchant, 'Round Six Product', 'round6-product', 'active'),
    (v_draft, v_merchant, 'Round Six Draft', 'round6-draft', 'draft');

  SELECT generation INTO v_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
    AND target_id = 'round-six';
  INSERT INTO public.product_offers (
    id, product_id, merchant_id, condition, price, stock_quantity, status
  ) VALUES (v_offer, v_product, v_merchant, 'used', 100, 1, 'active');
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'round-six') <> v_generation + 1 THEN
    RAISE EXCEPTION 'product offer INSERT must invalidate the active storefront';
  END IF;

  SELECT generation INTO v_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
    AND target_id = 'round-six';
  UPDATE public.product_offers SET price = 90 WHERE id = v_offer;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'round-six') <> v_generation + 1 THEN
    RAISE EXCEPTION 'product offer UPDATE must invalidate the active storefront';
  END IF;

  SELECT generation INTO v_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
    AND target_id = 'round-six';
  DELETE FROM public.product_offers WHERE id = v_offer;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'round-six') <> v_generation + 1 THEN
    RAISE EXCEPTION 'product offer DELETE must invalidate the active storefront';
  END IF;

  SELECT generation INTO v_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
    AND target_id = 'round-six';
  INSERT INTO public.product_key_specs (product_id, chipset, ram_gb)
  VALUES (v_product, 'Round Six Chip', 8);
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'round-six') <> v_generation + 1 THEN
    RAISE EXCEPTION 'product key-spec INSERT must invalidate the active storefront';
  END IF;

  SELECT generation INTO v_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
    AND target_id = 'round-six';
  UPDATE public.product_key_specs SET ram_gb = 12 WHERE product_id = v_product;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'round-six') <> v_generation + 1 THEN
    RAISE EXCEPTION 'product key-spec UPDATE must invalidate the active storefront';
  END IF;

  SELECT generation INTO v_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
    AND target_id = 'round-six';
  DELETE FROM public.product_key_specs WHERE product_id = v_product;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'round-six') <> v_generation + 1 THEN
    RAISE EXCEPTION 'product key-spec DELETE must invalidate the active storefront';
  END IF;

  SELECT generation INTO v_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
    AND target_id = 'round-six';
  INSERT INTO public.product_offers (
    product_id, merchant_id, condition, price, stock_quantity, status
  ) VALUES (v_draft, v_merchant, 'new', 20, 1, 'active');
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
        AND target_id = 'round-six') <> v_generation THEN
    RAISE EXCEPTION 'inactive product offer writes must not invalidate storefront cache';
  END IF;
END;
$$;

ROLLBACK;
