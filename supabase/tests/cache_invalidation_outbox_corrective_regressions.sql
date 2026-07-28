-- Exact regressions for policy-sensitive feed and relationship invalidation.
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_first_merchant uuid := '91000000-0000-4000-8000-000000000001';
  v_second_merchant uuid := '91000000-0000-4000-8000-000000000002';
  v_first_user uuid := '90000000-0000-4000-8000-000000000001';
  v_first_product uuid := '92000000-0000-4000-8000-000000000001';
  v_second_product uuid := '92000000-0000-4000-8000-000000000002';
  v_first_category uuid := '93000000-0000-4000-8000-000000000001';
  v_second_category uuid := '93000000-0000-4000-8000-000000000002';
  v_victim_category uuid := '93000000-0000-4000-8000-000000000003';
  v_membership uuid := '94000000-0000-4000-8000-000000000001';
  v_rls_membership uuid := '94000000-0000-4000-8000-000000000002';
  v_variant uuid := '95000000-0000-4000-8000-000000000001';
  v_first_generation bigint;
  v_second_generation bigint;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.product_categories AS membership
    JOIN public.products AS product ON product.id = membership.product_id
    JOIN public.categories AS category ON category.id = membership.category_id
    WHERE product.merchant_id IS DISTINCT FROM category.merchant_id
  ) THEN
    RAISE EXCEPTION 'legacy cross-merchant memberships must be removed';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.product_category_cross_tenant_archive AS archive
    WHERE archive.membership_id = 'a4000000-0000-4000-8000-000000000001'
      AND archive.product_id = 'a2000000-0000-4000-8000-000000000001'
      AND archive.category_id = 'a3000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'legacy cross-merchant memberships must remain archived';
  END IF;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = 'a1000000-0000-4000-8000-000000000001'
        AND target_id = 'legacy-one') <> 3
    OR EXISTS (
      SELECT 1 FROM public.cache_invalidation_outbox
      WHERE merchant_id = 'a1000000-0000-4000-8000-000000000002'
    ) THEN
    RAISE EXCEPTION 'legacy cleanup must enqueue only the product owner';
  END IF;

  INSERT INTO public.merchants (id, user_id, email, business_name, slug) VALUES
    (v_first_merchant, v_first_user, 'corrective-one@example.com', 'Corrective One', 'corrective-one'),
    (v_second_merchant, gen_random_uuid(), 'corrective-two@example.com', 'Corrective Two', 'corrective-two');
  INSERT INTO public.products (
    id, merchant_id, name, slug, status, manage_stock
  ) VALUES
    (v_first_product, v_first_merchant, 'First', 'first', 'active', true),
    (v_second_product, v_first_merchant, 'Second', 'second', 'active', true);
  INSERT INTO public.categories (id, merchant_id, name, slug, is_active) VALUES
    (v_first_category, v_first_merchant, 'First category', 'first-category', true),
    (v_second_category, v_first_merchant, 'Second category', 'second-category', true),
    (v_victim_category, v_second_merchant, 'Victim category', 'victim-category', true);

  PERFORM set_config('request.jwt.claim.sub', v_first_user::text, true);
  SELECT generation INTO v_first_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_first_merchant AND target_id = 'corrective-one';
  SELECT generation INTO v_second_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_second_merchant AND target_id = 'corrective-two';
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.product_categories (product_id, category_id)
    VALUES (v_first_product, v_victim_category);
    RAISE EXCEPTION 'cross-merchant membership must be denied';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
  INSERT INTO public.product_categories (id, product_id, category_id)
  VALUES (v_rls_membership, v_first_product, v_first_category);
  BEGIN
    UPDATE public.product_categories SET category_id = v_victim_category
    WHERE id = v_rls_membership;
    RAISE EXCEPTION 'cross-merchant membership update must be denied';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
  RESET ROLE;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_first_merchant AND target_id = 'corrective-one')
      <> v_first_generation + 1
    OR (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_second_merchant AND target_id = 'corrective-two')
      <> v_second_generation THEN
    RAISE EXCEPTION 'authenticated membership writes must queue only the owner';
  END IF;
  DELETE FROM public.product_categories WHERE id = v_rls_membership;

  SELECT generation INTO v_first_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_first_merchant AND target_id = 'corrective-one';
  UPDATE public.merchants SET gmc_variants_enabled = true
  WHERE id = v_first_merchant;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_first_merchant AND target_id = 'corrective-one')
    <> v_first_generation + 1 THEN
    RAISE EXCEPTION 'gmc_variants_enabled must enqueue feed invalidation';
  END IF;

  SELECT generation INTO v_first_generation
  FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_first_merchant AND target_id = 'corrective-one';
  INSERT INTO public.product_categories (id, product_id, category_id)
  VALUES (v_membership, v_first_product, v_first_category);
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_first_merchant AND target_id = 'corrective-one')
      <> v_first_generation + 1 THEN
    RAISE EXCEPTION 'membership insert must enqueue its merchant';
  END IF;

  SELECT generation INTO v_first_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_first_merchant AND target_id = 'corrective-one';
  UPDATE public.product_categories
  SET product_id = v_second_product WHERE id = v_membership;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_first_merchant AND target_id = 'corrective-one')
      <> v_first_generation + 1 THEN
    RAISE EXCEPTION 'product reassignment must enqueue old and new product targets';
  END IF;

  SELECT generation INTO v_first_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_first_merchant AND target_id = 'corrective-one';
  UPDATE public.product_categories
  SET category_id = v_second_category WHERE id = v_membership;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_first_merchant AND target_id = 'corrective-one')
      <> v_first_generation + 1 THEN
    RAISE EXCEPTION 'category reassignment must enqueue old and new category targets';
  END IF;

  SELECT generation INTO v_first_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_first_merchant AND target_id = 'corrective-one';
  DELETE FROM public.product_categories WHERE id = v_membership;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_first_merchant AND target_id = 'corrective-one')
      <> v_first_generation + 1 THEN
    RAISE EXCEPTION 'membership delete must enqueue its merchant';
  END IF;

  INSERT INTO public.product_variants (
    id, merchant_id, product_id, sku, stock_quantity, is_inventory_anchor
  ) VALUES (v_variant, v_first_merchant, v_first_product, 'ANCHOR', 1, false);
  UPDATE public.products SET manage_stock = false WHERE id = v_first_product;
  SELECT generation INTO v_first_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_first_merchant AND target_id = 'corrective-one';
  UPDATE public.product_variants
  SET is_inventory_anchor = true, stock_quantity = 2
  WHERE id = v_variant;
  IF (SELECT generation FROM public.cache_invalidation_outbox
      WHERE merchant_id = v_first_merchant AND target_id = 'corrective-one')
    <> v_first_generation + 1 THEN
    RAISE EXCEPTION 'anchor change must defeat unlimited-stock suppression';
  END IF;
END;
$$;

ROLLBACK;
