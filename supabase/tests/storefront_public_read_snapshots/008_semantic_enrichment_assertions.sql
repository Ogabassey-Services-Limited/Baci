DO $assertions$
DECLARE
  v_enrichment record;
  v_missing_enrichment record;
  v_oversized_enrichment record;
BEGIN
  SELECT
    enrichment.resolution_status,
    enrichment.inventory_data,
    enrichment.cluster_guide_data,
    enrichment.product_guide_data
  INTO v_enrichment
  FROM public.get_storefront_pdp_semantic_enrichment_v1(
    '4d19ab10-0000-4000-8000-000000000001',
    '4d19ab10-0000-4000-8000-000000000003',
    'snapshot-phones',
    '[{"rule_order":0,"category_slug":"snapshot-phones","category_names":["snapshot phones"],"article_tokens":["phone","battery"]}]'::jsonb,
    '"snapshot phones" OR "phone" OR "battery"',
    true,
    48,
    48,
    8
  ) AS enrichment;

  IF v_enrichment.resolution_status IS DISTINCT FROM 'found'
    OR NOT v_enrichment.inventory_data @> '[{"slug":"serialized-snapshot-phone"}]'::jsonb
    OR NOT v_enrichment.inventory_data @> '[{"slug":"child-category-snapshot-phone","categories":{"slug":"snapshot-android-phones"}}]'::jsonb
    OR NOT v_enrichment.cluster_guide_data @> '[{"slug":"snapshot-phones-buying-guide"}]'::jsonb
    OR v_enrichment.product_guide_data->0->>'slug' IS DISTINCT FROM
      'serialized-snapshot-phone-guide'
  THEN
    RAISE EXCEPTION
      'PDP semantic enrichment did not preserve current product, canonical child category, and bounded guides';
  END IF;

  SELECT
    enrichment.resolution_status,
    enrichment.inventory_data,
    enrichment.cluster_guide_data,
    enrichment.product_guide_data
  INTO v_missing_enrichment
  FROM public.get_storefront_pdp_semantic_enrichment_v1(
    '4d19ab10-0000-4000-8000-000000000001',
    '4d19ab10-0000-4000-8000-000000000099',
    'snapshot-phones',
    '[]'::jsonb,
    '',
    true,
    48,
    48,
    8
  ) AS enrichment;

  IF v_missing_enrichment.resolution_status IS DISTINCT FROM 'not_found'
    OR v_missing_enrichment.inventory_data IS NOT NULL
    OR v_missing_enrichment.cluster_guide_data IS NOT NULL
    OR v_missing_enrichment.product_guide_data IS NOT NULL
  THEN
    RAISE EXCEPTION
      'missing PDP semantic enrichment did not return explicit not_found';
  END IF;

  SELECT enrichment.resolution_status
  INTO v_oversized_enrichment
  FROM public.get_storefront_pdp_semantic_enrichment_v1(
    '4d19ab10-0000-4000-8000-000000000001',
    '4d19ab10-0000-4000-8000-000000000003',
    pg_catalog.repeat('oversized-', 1000),
    '[]'::jsonb,
    '',
    false,
    48,
    48,
    8
  ) AS enrichment;

  IF v_oversized_enrichment.resolution_status IS DISTINCT FROM 'not_found'
  THEN
    RAISE EXCEPTION 'oversized semantic category input was not rejected';
  END IF;
END;
$assertions$;
