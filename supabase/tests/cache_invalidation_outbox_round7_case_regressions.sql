-- Product identifiers are case-sensitive cache-tag inputs. Validation may fold
-- case, but storage and case-only rename duties must preserve original bytes.
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_merchant uuid := 'f2100000-0000-4000-8000-000000000001';
  v_product uuid := 'f2200000-0000-4000-8000-000000000001';
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (v_merchant, 'round7-case@example.com', 'Round Seven Case',
    'round-seven-case');

  PERFORM public.enqueue_storefront_product_cache_target(
    v_merchant, '  MixedCase-SKU  '
  );
  IF NOT EXISTS (
    SELECT 1
    FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant
      AND target_kind = 'storefront_product'
      AND target_id = 'MixedCase-SKU'
      AND product_slugs = ARRAY['MixedCase-SKU']
  ) THEN
    RAISE EXCEPTION
      'mixed-case exact product identifiers must retain their stored case';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant
      AND target_kind = 'storefront_product'
      AND target_id = 'mixedcase-sku'
  ) THEN
    RAISE EXCEPTION 'mixed-case exact identifiers must not be folded in storage';
  END IF;

  PERFORM public.enqueue_storefront_product_cache_target(
    v_merchant, 'Invalid_Name'
  );
  IF EXISTS (
    SELECT 1
    FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant
      AND target_kind = 'storefront_product'
      AND target_id IN ('Invalid_Name', 'invalid_name')
  ) THEN
    RAISE EXCEPTION 'exact identifier validation must remain case-insensitive';
  END IF;

  DELETE FROM public.cache_invalidation_outbox WHERE merchant_id = v_merchant;
  INSERT INTO public.products (id, merchant_id, name, slug, status)
  VALUES (v_product, v_merchant, 'Case Rename Product', 'CaseOnly-Slug',
    'active');
  DELETE FROM public.cache_invalidation_outbox WHERE merchant_id = v_merchant;

  UPDATE public.products
  SET slug = 'caseonly-slug'
  WHERE id = v_product;

  IF NOT EXISTS (
      SELECT 1 FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant
        AND target_kind = 'storefront_product'
        AND target_id = 'CaseOnly-Slug'
    ) OR NOT EXISTS (
      SELECT 1 FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_merchant
        AND target_kind = 'storefront_product'
        AND target_id = 'caseonly-slug'
    ) THEN
    RAISE EXCEPTION
      'case-only rename must enqueue both old and new exact identifiers';
  END IF;

  IF NOT (
    SELECT product_slugs @> ARRAY['CaseOnly-Slug', 'caseonly-slug']
    FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant
      AND target_kind = 'storefront_slug'
      AND target_id = 'round-seven-case'
  ) THEN
    RAISE EXCEPTION
      'broad purge duties must retain both case-only rename identifiers';
  END IF;
END;
$$;

ROLLBACK;
