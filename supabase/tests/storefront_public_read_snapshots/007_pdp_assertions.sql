DO $assertions$
DECLARE
  v_long_slug_product record;
  v_simple record;
  v_variant record;
  v_redirect record;
  v_blank_redirect record;
  v_hidden_category record;
  v_large_variant record;
  v_missing record;
BEGIN
  SELECT snapshot.resolution_status, snapshot.product_data
  INTO v_long_slug_product
  FROM public.get_storefront_pdp_core_v2(
    '4d19ab10-0000-4000-8000-000000000001',
    'long-slug-' || pg_catalog.repeat('x', 210),
    NULL
  ) AS snapshot;

  IF v_long_slug_product.resolution_status IS DISTINCT FROM 'found'
    OR v_long_slug_product.product_data->>'id' IS DISTINCT FROM
      '4d19ab10-0000-4000-8000-000000000019'
  THEN
    RAISE EXCEPTION
      'long-slug PDP within the 512-byte route contract did not resolve';
  END IF;

  SELECT snapshot.resolution_status, snapshot.product_data
  INTO v_simple
  FROM public.get_storefront_pdp_core_v2(
    '4d19ab10-0000-4000-8000-000000000001',
    'serialized-snapshot-phone',
    NULL
  ) AS snapshot;

  IF v_simple.resolution_status IS DISTINCT FROM 'found'
    OR (v_simple.product_data->>'stock_quantity')::integer IS DISTINCT FROM 1
    OR (v_simple.product_data->>'manage_stock')::boolean IS DISTINCT FROM true
    OR v_simple.product_data->'categories'->>'slug' IS DISTINCT FROM
      'snapshot-phones'
  THEN
    RAISE EXCEPTION 'simple PDP snapshot did not apply serialized availability';
  END IF;

  SELECT snapshot.resolution_status, snapshot.product_data
  INTO v_variant
  FROM public.get_storefront_pdp_core_v2(
    '4d19ab10-0000-4000-8000-000000000001',
    'variant-snapshot-phone',
    NULL
  ) AS snapshot;

  IF v_variant.resolution_status IS DISTINCT FROM 'found'
    OR pg_catalog.jsonb_array_length(
      v_variant.product_data->'product_variants'
    ) IS DISTINCT FROM 1
    OR (
      v_variant.product_data->'product_variants'->0->>'stock_quantity'
    )::integer IS DISTINCT FROM 1
  THEN
    RAISE EXCEPTION 'variant PDP snapshot did not apply serialized availability';
  END IF;

  SELECT snapshot.resolution_status, snapshot.product_data
  INTO v_redirect
  FROM public.get_storefront_pdp_core_v2(
    '4d19ab10-0000-4000-8000-000000000001',
    'legacy-variant-snapshot-phone',
    NULL
  ) AS snapshot;

  IF v_redirect.resolution_status IS DISTINCT FROM 'redirect'
    OR v_redirect.product_data->>'id' IS DISTINCT FROM
      '4d19ab10-0000-4000-8000-000000000005'
    OR v_redirect.product_data->>'slug' IS DISTINCT FROM
      'variant-snapshot-phone'
    OR v_redirect.product_data->'categories'->>'slug' IS DISTINCT FROM
      'snapshot-phones'
  THEN
    RAISE EXCEPTION 'legacy PDP snapshot did not return canonical redirect';
  END IF;

  SELECT snapshot.resolution_status, snapshot.product_data
  INTO v_blank_redirect
  FROM public.get_storefront_pdp_core_v2(
    '4d19ab10-0000-4000-8000-000000000001',
    'legacy-blank-slug-snapshot-phone',
    NULL
  ) AS snapshot;

  IF v_blank_redirect.resolution_status IS DISTINCT FROM 'not_found'
    OR v_blank_redirect.product_data IS NOT NULL
  THEN
    RAISE EXCEPTION 'legacy PDP snapshot returned an unusable blank redirect';
  END IF;

  SELECT snapshot.resolution_status, snapshot.product_data
  INTO v_hidden_category
  FROM public.get_storefront_pdp_core_v2(
    '4d19ab10-0000-4000-8000-000000000001',
    'hidden-category-snapshot-phone',
    NULL
  ) AS snapshot;

  IF v_hidden_category.resolution_status IS DISTINCT FROM 'found'
    OR v_hidden_category.product_data->'categories' IS DISTINCT FROM
      'null'::jsonb
  THEN
    RAISE EXCEPTION 'public PDP snapshot exposed an inactive category';
  END IF;

  SELECT snapshot.resolution_status, snapshot.product_data
  INTO v_large_variant
  FROM public.get_storefront_pdp_core_v2(
    '4d19ab10-0000-4000-8000-000000000001',
    'large-variant-snapshot-phone',
    NULL
  ) AS snapshot;

  IF v_large_variant.resolution_status IS DISTINCT FROM 'found'
    OR (v_large_variant.product_data->>'variant_count')::integer
      IS DISTINCT FROM 130
    OR (v_large_variant.product_data->>'variants_truncated')::boolean
      IS DISTINCT FROM true
    OR pg_catalog.jsonb_array_length(
      v_large_variant.product_data->'product_variants'
    ) IS DISTINCT FROM 128
    OR NOT v_large_variant.product_data->'product_variants' @>
      '[{"id":"4d19ab10-0000-4001-8000-000000000130"}]'::jsonb
  THEN
    RAISE EXCEPTION
      'bounded PDP snapshot omitted its default variant or overflow signal';
  END IF;

  SELECT snapshot.resolution_status, snapshot.product_data
  INTO v_missing
  FROM public.get_storefront_pdp_core_v2(
    '4d19ab10-0000-4000-8000-000000000001',
    'missing-snapshot-product',
    NULL
  ) AS snapshot;

  IF v_missing.resolution_status IS DISTINCT FROM 'not_found'
    OR v_missing.product_data IS NOT NULL
  THEN
    RAISE EXCEPTION 'missing PDP snapshot did not return explicit not_found';
  END IF;
END;
$assertions$;
