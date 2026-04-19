-- Prevent product_variants variant_key collisions during canonicalization by
-- archiving and removing alias rows whose condition would collapse onto an
-- existing canonical row for the same product + attributes.

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
  source_migration TEXT NOT NULL DEFAULT '20260415191445_dedupe_product_variant_condition_aliases'
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

WITH alias_variant_rows AS (
  SELECT
    alias_variant.id AS variant_id,
    alias_variant.product_id,
    alias_variant.merchant_id,
    alias_variant.condition,
    alias_variant.variant_key,
    public.canonicalize_rollout_product_condition(alias_variant.condition) AS canonical_condition,
    public.build_product_variant_key(
      public.canonicalize_rollout_product_condition(alias_variant.condition),
      alias_variant.attributes
    ) AS canonical_variant_key,
    to_jsonb(alias_variant) AS row_data
  FROM public.product_variants AS alias_variant
  WHERE alias_variant.condition IS NOT NULL
),
duplicate_alias_rows AS (
  SELECT
    alias_variant_rows.variant_id,
    alias_variant_rows.product_id,
    alias_variant_rows.merchant_id,
    alias_variant_rows.condition,
    alias_variant_rows.canonical_condition,
    canonical_variant.id AS canonical_variant_id,
    alias_variant_rows.variant_key,
    alias_variant_rows.row_data
  FROM alias_variant_rows
  JOIN public.product_variants AS canonical_variant
    ON canonical_variant.product_id = alias_variant_rows.product_id
   AND canonical_variant.variant_key = alias_variant_rows.canonical_variant_key
   AND canonical_variant.id <> alias_variant_rows.variant_id
  WHERE alias_variant_rows.canonical_condition IS NOT NULL
    AND alias_variant_rows.condition IS DISTINCT FROM alias_variant_rows.canonical_condition
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
    duplicate_alias_rows.variant_id,
    duplicate_alias_rows.product_id,
    duplicate_alias_rows.merchant_id,
    duplicate_alias_rows.condition,
    duplicate_alias_rows.canonical_condition,
    duplicate_alias_rows.canonical_variant_id,
    duplicate_alias_rows.variant_key,
    duplicate_alias_rows.row_data,
    'deduped_condition_alias_before_canonicalization',
    '20260415191445_dedupe_product_variant_condition_aliases'
  FROM duplicate_alias_rows
  ON CONFLICT (variant_id) DO NOTHING
  RETURNING variant_id
)
DELETE FROM public.product_variants AS product_variants
USING archived_duplicates
WHERE product_variants.id = archived_duplicates.variant_id;
