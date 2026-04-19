WITH legacy_child_variants AS (
  SELECT
    parent.id AS product_id,
    parent.merchant_id,
    child.id AS child_product_id,
    child.name AS child_name,
    child.price,
    child.cost_price,
    child.stock_quantity,
    child.sku,
    child.images,
    child.created_at,
    CASE
      WHEN child.variant_attributes IS NOT NULL
        AND jsonb_typeof(child.variant_attributes) = 'array' THEN (
          SELECT coalesce(
            jsonb_object_agg(
              lower(regexp_replace(coalesce(entry->>'param', ''), '[^a-zA-Z0-9]+', '_', 'g')),
              coalesce(
                entry->'options'->>0,
                entry->>'value',
                entry->>'name',
                entry->>'label'
              )
            ),
            '{}'::jsonb
          )
          FROM jsonb_array_elements(child.variant_attributes) entry
        )
      WHEN child.variant_attributes IS NOT NULL
        AND jsonb_typeof(child.variant_attributes) = 'object' THEN child.variant_attributes
      ELSE '{}'::jsonb
    END AS normalized_attributes,
    CASE
      WHEN substring(child.name FROM '\(([^)]+)\)') IS NOT NULL THEN jsonb_strip_nulls(
        jsonb_build_object(
          'storage',
          nullif(trim(split_part(substring(child.name FROM '\(([^)]+)\)'), '+', 1)), ''),
          'ram',
          nullif(trim(split_part(substring(child.name FROM '\(([^)]+)\)'), '+', 2)), '')
        )
      )
      ELSE '{}'::jsonb
    END AS extracted_attributes
  FROM public.products parent
  JOIN public.products child
    ON child.parent_product_id = parent.id
   AND child.merchant_id = parent.merchant_id
  WHERE parent.has_variants = true
    AND parent.parent_product_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.product_variants existing
      WHERE existing.product_id = parent.id
        AND existing.merchant_id = parent.merchant_id
    )
),
rows_to_insert AS (
  SELECT
    product_id,
    merchant_id,
    CASE
      WHEN normalized_attributes = '{}'::jsonb
        THEN extracted_attributes
      ELSE normalized_attributes || extracted_attributes
    END AS attributes,
    price AS price_override,
    cost_price,
    stock_quantity,
    sku,
    images,
    images->>0 AS primary_image,
    created_at,
    now() AS updated_at
  FROM legacy_child_variants
)
INSERT INTO public.product_variants (
  product_id,
  merchant_id,
  attributes,
  price_override,
  cost_price,
  stock_quantity,
  sku,
  images,
  primary_image,
  created_at,
  updated_at
)
SELECT
  product_id,
  merchant_id,
  attributes,
  price_override,
  cost_price,
  stock_quantity,
  sku,
  images,
  primary_image,
  created_at,
  updated_at
FROM rows_to_insert;
