-- Prevent idx_product_variants_product_id_variant_key creation from failing on
-- pre-existing duplicate variant rows that already share the same normalized
-- condition + attributes.

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

CREATE TABLE IF NOT EXISTS public.product_variant_migration_archive (
  variant_id UUID PRIMARY KEY,
  product_id UUID NOT NULL,
  merchant_id UUID NOT NULL,
  condition TEXT,
  canonical_condition TEXT NOT NULL,
  canonical_variant_id UUID NOT NULL,
  variant_key TEXT,
  row_data JSONB NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archive_reason TEXT NOT NULL,
  source_migration TEXT NOT NULL DEFAULT '20260415122950_dedupe_product_variant_keys_before_unique_index'
);

CREATE INDEX IF NOT EXISTS idx_product_variant_migration_archive_product_id
  ON public.product_variant_migration_archive(product_id);

CREATE INDEX IF NOT EXISTS idx_product_variant_migration_archive_merchant_id
  ON public.product_variant_migration_archive(merchant_id);

ALTER TABLE public.product_variant_migration_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view archived product variants"
  ON public.product_variant_migration_archive;
CREATE POLICY "Merchants can view archived product variants"
  ON public.product_variant_migration_archive
  FOR SELECT
  TO authenticated
  USING (
    merchant_id = auth.uid()
    OR merchant_id IN (
      SELECT id
      FROM public.merchants
      WHERE user_id = auth.uid()
    )
  );

GRANT SELECT ON public.product_variant_migration_archive TO authenticated;
GRANT ALL ON public.product_variant_migration_archive TO service_role;

WITH variant_rows AS (
  SELECT
    pv.id AS variant_id,
    pv.product_id,
    pv.merchant_id,
    pv.condition,
    public.normalize_variant_axis_value(pv.condition) AS canonical_condition,
    public.build_product_variant_key(pv.condition, pv.attributes) AS computed_variant_key,
    to_jsonb(pv) AS row_data,
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
    variant_rows.*,
    first_value(variant_id) OVER (
      PARTITION BY product_id, computed_variant_key
      ORDER BY order_item_ref_count DESC, created_at ASC NULLS LAST, variant_id ASC
    ) AS canonical_variant_id,
    row_number() OVER (
      PARTITION BY product_id, computed_variant_key
      ORDER BY order_item_ref_count DESC, created_at ASC NULLS LAST, variant_id ASC
    ) AS variant_rank
  FROM variant_rows
),
duplicate_variant_rows AS (
  SELECT *
  FROM ranked_variant_rows
  WHERE variant_rank > 1
),
archived_duplicates AS (
  INSERT INTO public.product_variant_migration_archive (
    variant_id,
    product_id,
    merchant_id,
    condition,
    canonical_condition,
    canonical_variant_id,
    variant_key,
    row_data,
    archive_reason,
    source_migration
  )
  SELECT
    duplicate_variant_rows.variant_id,
    duplicate_variant_rows.product_id,
    duplicate_variant_rows.merchant_id,
    duplicate_variant_rows.condition,
    COALESCE(duplicate_variant_rows.canonical_condition, 'new'),
    duplicate_variant_rows.canonical_variant_id,
    duplicate_variant_rows.computed_variant_key,
    duplicate_variant_rows.row_data,
    'deduped_variant_key_before_unique_index',
    '20260415122950_dedupe_product_variant_keys_before_unique_index'
  FROM duplicate_variant_rows
  ON CONFLICT (variant_id) DO NOTHING
  RETURNING variant_id
)
DELETE FROM public.product_variants AS product_variants
USING archived_duplicates
WHERE product_variants.id = archived_duplicates.variant_id;
