-- Exact regressions for the B0 current-head review follow-up.
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_merchant uuid := '81000000-0000-4000-8000-000000000001';
  v_product uuid := '82000000-0000-4000-8000-000000000001';
  v_draft uuid := '82000000-0000-4000-8000-000000000002';
  v_generation bigint;
  v_next_generation bigint;
  v_update record;
  v_has_dead_letters boolean;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (v_merchant, 'review@example.com', 'Review Store', 'review-store');
  INSERT INTO public.merchant_slug_aliases (old_slug, merchant_id) VALUES
    ('review-store-old', v_merchant),
    ('review-store-older', v_merchant);
  INSERT INTO public.categories (id, merchant_id, name, slug, is_active)
  VALUES (
    '83000000-0000-4000-8000-000000000001', v_merchant,
    'Review category', 'review-category', true
  );
  INSERT INTO public.brands (id, merchant_id, name)
  VALUES ('83000000-0000-4000-8000-000000000002', v_merchant, 'Baci');
  INSERT INTO public.products (id, merchant_id, name, slug, status)
  VALUES (
    '83000000-0000-4000-8000-000000000003', v_merchant,
    'Review parent', 'review-parent', 'active'
  );
  INSERT INTO public.products (
    id, merchant_id, name, price, slug, status, manage_stock, stock_quantity
  ) VALUES (
    v_product, v_merchant, 'Review Phone', 100, 'review-phone',
    'active', true, 2
  );
  INSERT INTO public.product_variants (id, merchant_id, product_id, sku)
  VALUES
    ('83000000-0000-4000-8000-000000000004', v_merchant, v_product,
      'REVIEW-DEFAULT'),
    ('83000000-0000-4000-8000-000000000005', v_merchant, v_product,
      'REVIEW-ANCHOR');

  IF NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
      AND target_id = 'review-store-old'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_kind = 'storefront_slug'
      AND target_id = 'review-store-older'
  ) THEN
    RAISE EXCEPTION 'every durable merchant slug alias must be enqueued';
  END IF;

  UPDATE public.products SET manage_stock = false WHERE id = v_product;
  SELECT generation INTO v_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_id = 'review-store';
  UPDATE public.products
  SET stock_quantity = 99, updated_at = now() + interval '1 second'
  WHERE id = v_product;
  SELECT generation INTO v_next_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_id = 'review-store';
  IF v_next_generation <> v_generation THEN
    RAISE EXCEPTION 'updated_at must not defeat unlimited-stock suppression';
  END IF;

  SELECT generation INTO v_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_id = 'review-store';
  INSERT INTO public.products (
    id, merchant_id, name, price, slug, status, manage_stock
  ) VALUES (
    v_draft, v_merchant, 'Null Draft', 50, 'null-draft', NULL, false
  );
  DELETE FROM public.products WHERE id = v_draft;
  SELECT generation INTO v_next_generation FROM public.cache_invalidation_outbox
  WHERE merchant_id = v_merchant AND target_id = 'review-store';
  IF v_next_generation <> v_generation THEN
    RAISE EXCEPTION 'null-status draft insert/delete must not enqueue';
  END IF;

  UPDATE public.products SET manage_stock = true WHERE id = v_product;
  FOR v_update IN
    SELECT * FROM (VALUES
      ('name', quote_literal('Review Phone 2')),
      ('slug', quote_literal('review-phone-2')),
      ('description', quote_literal('Public description')),
      ('price', '101'), ('compare_at_price', '120'),
      ('images', quote_literal('["phone-2.jpg"]') || '::jsonb'),
      ('color_images', quote_literal('{"black":["black.jpg"]}') || '::jsonb'),
      ('image_hint', quote_literal('front view')),
      ('status', quote_literal('active')), ('category', quote_literal('Phones')),
      ('category_id', quote_literal('83000000-0000-4000-8000-000000000001') || '::uuid'),
      ('meta_title', quote_literal('Public title')),
      ('meta_description', quote_literal('Public metadata')),
      ('keywords', 'ARRAY[''phone'',''review'']::text[]'),
      ('canonical_url', quote_literal('https://example.com/review-phone-2')),
      ('schema_markup', quote_literal('{"@type":"Product"}') || '::jsonb'),
      ('faqs', quote_literal('[{"q":"Q","a":"A"}]') || '::jsonb'),
      ('specifications', quote_literal('{"ram":"8GB"}') || '::jsonb'),
      ('offers', quote_literal('[{"price":101}]') || '::jsonb'),
      ('available_conditions', 'ARRAY[''new'',''used'']::text[]'),
      ('condition', quote_literal('new')),
      ('condition_detail', quote_literal('sealed')),
      ('has_condition_offers', 'true'), ('has_variants', 'true'),
      ('brand', quote_literal('Baci')), ('brand_id', quote_literal('83000000-0000-4000-8000-000000000002') || '::uuid'),
      ('color', quote_literal('Black')),
      ('parent_product_id', quote_literal('83000000-0000-4000-8000-000000000003') || '::uuid'),
      ('default_variant_id', quote_literal('83000000-0000-4000-8000-000000000004') || '::uuid'),
      ('inventory_tracking_policy', quote_literal('serialized')),
      ('stock', '7'), ('stock_quantity', '7'),
      ('gtin', quote_literal('1234567890123')), ('mpn', quote_literal('MPN-2')),
      ('google_product_category', quote_literal('Electronics > Phones')),
      ('sku', quote_literal('SKU-2')), ('low_stock_threshold', '2'),
      ('variant_attributes', quote_literal('{"storage":["128GB"]}') || '::jsonb'),
      ('variant_model', quote_literal('sku_matrix')),
      ('min_variant_price', '95'), ('max_variant_price', '130'),
      ('dimensions', quote_literal('{"length":10}') || '::jsonb'),
      ('weight_value', '0.5'), ('weight_unit', quote_literal('kg')),
      ('metadata', quote_literal('{"public_badge":"new"}') || '::jsonb'),
      ('fulfillment_details', quote_literal('{"lead_time":2}') || '::jsonb'),
      ('fulfillment_fields', quote_literal('{"imei":true}') || '::jsonb'),
      ('average_rating', '4.5'), ('review_count', '10'), ('is_parent', 'true'),
      ('inventory_anchor_variant_id', quote_literal('83000000-0000-4000-8000-000000000005') || '::uuid'),
      ('taxable', 'true'), ('tax_exempt', 'false'),
      ('tax_code', quote_literal('VAT')), ('vat_rate', '7.5'),
      ('vat_category_code', quote_literal('S')),
      ('commodity_code', quote_literal('851713')),
      ('unit_code', quote_literal('EA')),
      ('created_at', 'now() - interval ''1 day'''),
      ('updated_at', 'now() - interval ''1 day''')
    ) AS updates(column_name, sql_value)
  LOOP
    SELECT generation INTO v_generation FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_id = 'review-store';
    EXECUTE format(
      'UPDATE public.products SET %I = %s WHERE id = %L::uuid',
      v_update.column_name, v_update.sql_value, v_product
    );
    SELECT generation INTO v_next_generation FROM public.cache_invalidation_outbox
    WHERE merchant_id = v_merchant AND target_id = 'review-store';
    IF v_next_generation <> v_generation + 1 THEN
      RAISE EXCEPTION 'public product column % did not enqueue', v_update.column_name;
    END IF;
  END LOOP;

  UPDATE public.cache_invalidation_outbox
  SET status = 'dead_letter'
  WHERE merchant_id = v_merchant AND target_id = 'review-store-old';
  SELECT public.has_cache_invalidation_dead_letters()
  INTO v_has_dead_letters;
  IF v_has_dead_letters IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'dead-letter alert state must surface terminal work';
  END IF;
END;
$$;

ROLLBACK;
