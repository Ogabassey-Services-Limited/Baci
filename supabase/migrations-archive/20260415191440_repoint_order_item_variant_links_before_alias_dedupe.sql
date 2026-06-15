-- Preserve historical order-item variant attribution before removing alias
-- product_variants rows during condition canonicalization dedupe.

CREATE OR REPLACE FUNCTION public.canonicalize_rollout_product_condition(p_value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $$
  WITH normalized_input AS (
    SELECT NULLIF(
      lower(regexp_replace(trim(COALESCE(p_value, '')), '[\s-]+', '_', 'g')),
      ''
    ) AS normalized_value
  )
  SELECT CASE normalized_value
    WHEN 'uk_used' THEN 'used'
    WHEN 'refurbished' THEN 'open_box'
    WHEN 'new' THEN 'new'
    WHEN 'used' THEN 'used'
    WHEN 'open_box' THEN 'open_box'
    ELSE NULL
  END
  FROM normalized_input;
$$;

WITH alias_variant_rows AS (
  SELECT
    alias_variant.id AS variant_id,
    alias_variant.product_id,
    public.canonicalize_rollout_product_condition(alias_variant.condition) AS canonical_condition,
    public.build_product_variant_key(
      public.canonicalize_rollout_product_condition(alias_variant.condition),
      alias_variant.attributes
    ) AS canonical_variant_key
  FROM public.product_variants AS alias_variant
  WHERE alias_variant.condition IS NOT NULL
),
duplicate_alias_rows AS (
  SELECT
    alias_variant_rows.variant_id,
    canonical_variant.id AS canonical_variant_id
  FROM alias_variant_rows
  JOIN public.product_variants AS canonical_variant
    ON canonical_variant.product_id = alias_variant_rows.product_id
   AND canonical_variant.variant_key = alias_variant_rows.canonical_variant_key
   AND canonical_variant.id <> alias_variant_rows.variant_id
  WHERE alias_variant_rows.canonical_condition IS NOT NULL
)
UPDATE public.order_items AS oi
SET variant_id = duplicate_alias_rows.canonical_variant_id
FROM duplicate_alias_rows
WHERE oi.variant_id = duplicate_alias_rows.variant_id
  AND oi.variant_id IS DISTINCT FROM duplicate_alias_rows.canonical_variant_id;
