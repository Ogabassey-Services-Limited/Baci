-- Preserve historical order-item variant attribution before removing duplicate
-- product_variants rows during the pre-index dedupe step.

CREATE OR REPLACE FUNCTION public.normalize_variant_axis_value(p_value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $$
  SELECT NULLIF(
    lower(regexp_replace(trim(COALESCE(p_value, '')), '[\s-]+', '_', 'g')),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.build_product_variant_key(
  p_condition TEXT,
  p_attributes JSONB
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'condition',
    public.normalize_variant_axis_value(p_condition),
    'attributes',
    COALESCE(
      (
        SELECT jsonb_object_agg(
                 lower(attrs.key),
                 lower(regexp_replace(trim(attrs.value), '\s+', ' ', 'g'))
                 ORDER BY lower(attrs.key)
               )
        FROM jsonb_each_text(COALESCE(p_attributes, '{}'::jsonb)) AS attrs(key, value)
        WHERE trim(attrs.value) <> ''
      ),
      '{}'::jsonb
    )
  )::TEXT;
$$;

WITH variant_rows AS (
  SELECT
    pv.id AS variant_id,
    pv.product_id,
    public.build_product_variant_key(pv.condition, pv.attributes) AS computed_variant_key,
    COALESCE((
      SELECT count(*)
      FROM public.order_items AS oi
      WHERE oi.variant_id = pv.id
    ), 0) AS order_item_ref_count,
    pv.created_at
  FROM public.product_variants AS pv
),
ranked_variant_rows AS (
  SELECT
    variant_rows.variant_id,
    first_value(variant_rows.variant_id) OVER (
      PARTITION BY variant_rows.product_id, variant_rows.computed_variant_key
      ORDER BY
        variant_rows.order_item_ref_count DESC,
        variant_rows.created_at ASC NULLS LAST,
        variant_rows.variant_id ASC
    ) AS canonical_variant_id,
    row_number() OVER (
      PARTITION BY variant_rows.product_id, variant_rows.computed_variant_key
      ORDER BY
        variant_rows.order_item_ref_count DESC,
        variant_rows.created_at ASC NULLS LAST,
        variant_rows.variant_id ASC
    ) AS variant_rank
  FROM variant_rows
),
duplicate_variant_rows AS (
  SELECT
    ranked_variant_rows.variant_id,
    ranked_variant_rows.canonical_variant_id
  FROM ranked_variant_rows
  WHERE ranked_variant_rows.variant_rank > 1
)
UPDATE public.order_items AS oi
SET variant_id = duplicate_variant_rows.canonical_variant_id
FROM duplicate_variant_rows
WHERE oi.variant_id = duplicate_variant_rows.variant_id
  AND oi.variant_id IS DISTINCT FROM duplicate_variant_rows.canonical_variant_id;
