-- Prepare safe legacy products for the sku_matrix migration that follows.
-- This migration only touches cases that can be converted without inventing
-- attribute combinations:
--   1. parent condition + existing variants + no offers
--   2. simple offer-only products with no variant rows

CREATE OR REPLACE FUNCTION public.normalize_variant_axis_value(p_value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT NULLIF(
    lower(regexp_replace(trim(COALESCE(p_value, '')), '[\s-]+', '_', 'g')),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.extract_primary_image_from_jsonb(p_images JSONB)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_images IS NULL OR jsonb_typeof(p_images) <> 'array' OR jsonb_array_length(p_images) = 0
      THEN NULL
    WHEN jsonb_typeof(p_images->0) = 'object'
      THEN COALESCE(
        NULLIF(trim(p_images->0->>'url'), ''),
        NULLIF(trim(p_images->0->>'src'), ''),
        NULLIF(trim(p_images->0->>'image'), '')
      )
    ELSE NULLIF(trim(p_images->>0), '')
  END;
$$;

CREATE TABLE IF NOT EXISTS public.product_offer_migration_archive (
  offer_id UUID PRIMARY KEY,
  product_id UUID NOT NULL,
  merchant_id UUID NOT NULL,
  condition TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  compare_at_price NUMERIC(10, 2),
  stock_quantity INTEGER NOT NULL,
  images JSONB,
  condition_notes TEXT,
  grade TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archive_reason TEXT NOT NULL,
  source_migration TEXT NOT NULL DEFAULT '20260415110000_prepare_legacy_products_for_sku_matrix'
);

CREATE INDEX IF NOT EXISTS idx_product_offer_migration_archive_product_id
  ON public.product_offer_migration_archive(product_id);

CREATE INDEX IF NOT EXISTS idx_product_offer_migration_archive_merchant_id
  ON public.product_offer_migration_archive(merchant_id);

ALTER TABLE public.product_offer_migration_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view archived product offers"
  ON public.product_offer_migration_archive;
CREATE POLICY "Merchants can view archived product offers"
  ON public.product_offer_migration_archive
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

GRANT SELECT ON public.product_offer_migration_archive TO authenticated;
GRANT ALL ON public.product_offer_migration_archive TO service_role;

WITH safe_parent_condition_products AS (
  SELECT
    p.id AS product_id,
    public.normalize_variant_axis_value(p.condition) AS normalized_condition
  FROM public.products AS p
  WHERE p.condition IS NOT NULL
    AND trim(p.condition) <> ''
    AND EXISTS (
      SELECT 1
      FROM public.product_variants AS pv
      WHERE pv.product_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.product_offers AS po
      WHERE po.product_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.product_variants AS pv
      WHERE pv.product_id = p.id
        AND pv.condition IS NOT NULL
    )
)
UPDATE public.product_variants AS pv
SET condition = safe_parent_condition_products.normalized_condition
FROM safe_parent_condition_products
WHERE pv.product_id = safe_parent_condition_products.product_id
  AND pv.condition IS DISTINCT FROM safe_parent_condition_products.normalized_condition;

WITH safe_parent_condition_products AS (
  SELECT DISTINCT p.id AS product_id
  FROM public.products AS p
  WHERE p.condition IS NOT NULL
    AND trim(p.condition) <> ''
    AND EXISTS (
      SELECT 1
      FROM public.product_variants AS pv
      WHERE pv.product_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.product_offers AS po
      WHERE po.product_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.product_variants AS pv
      WHERE pv.product_id = p.id
        AND pv.condition IS NULL
    )
)
UPDATE public.products AS p
SET has_variants = TRUE
FROM safe_parent_condition_products
WHERE p.id = safe_parent_condition_products.product_id
  AND COALESCE(p.has_variants, FALSE) = FALSE;

WITH simple_offer_products AS (
  SELECT p.id
  FROM public.products AS p
  WHERE NOT EXISTS (
      SELECT 1
      FROM public.product_variants AS pv
      WHERE pv.product_id = p.id
    )
    AND EXISTS (
      SELECT 1
      FROM public.product_offers AS po
      WHERE po.product_id = p.id
    )
    AND p.compare_at_price IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.product_offers AS po
      WHERE po.product_id = p.id
        AND (
          po.compare_at_price IS NOT NULL
          OR po.grade IS NOT NULL
          OR NULLIF(btrim(COALESCE(po.condition_notes, '')), '') IS NOT NULL
          OR COALESCE(po.status, 'active') <> 'active'
        )
    )
)
INSERT INTO public.product_offer_migration_archive (
  offer_id,
  product_id,
  merchant_id,
  condition,
  price,
  compare_at_price,
  stock_quantity,
  images,
  condition_notes,
  grade,
  status,
  created_at,
  updated_at,
  archive_reason
)
SELECT
  po.id,
  po.product_id,
  po.merchant_id,
  po.condition,
  po.price,
  po.compare_at_price,
  po.stock_quantity,
  po.images,
  po.condition_notes,
  po.grade,
  po.status,
  po.created_at,
  po.updated_at,
  'converted_simple_offers_to_sku_matrix'
FROM public.product_offers AS po
JOIN simple_offer_products AS p
  ON p.id = po.product_id
ON CONFLICT (offer_id) DO NOTHING;

WITH archived_simple_offers AS (
  SELECT DISTINCT archive.product_id
  FROM public.product_offer_migration_archive AS archive
  WHERE archive.archive_reason = 'converted_simple_offers_to_sku_matrix'
    AND archive.source_migration = '20260415110000_prepare_legacy_products_for_sku_matrix'
)
INSERT INTO public.product_variants (
  product_id,
  merchant_id,
  attributes,
  condition,
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
  p.id,
  p.merchant_id,
  '{}'::jsonb,
  public.normalize_variant_axis_value(archive.condition),
  archive.price,
  p.cost_price,
  archive.stock_quantity,
  NULL,
  COALESCE(archive.images, '[]'::jsonb),
  public.extract_primary_image_from_jsonb(COALESCE(archive.images, '[]'::jsonb)),
  COALESCE(archive.created_at, NOW()),
  NOW()
FROM archived_simple_offers AS candidates
JOIN public.products AS p
  ON p.id = candidates.product_id
JOIN public.product_offer_migration_archive AS archive
  ON archive.product_id = p.id
WHERE archive.archive_reason = 'converted_simple_offers_to_sku_matrix'
  AND archive.source_migration = '20260415110000_prepare_legacy_products_for_sku_matrix'
  AND NOT EXISTS (
    SELECT 1
    FROM public.product_variants AS existing
    WHERE existing.product_id = p.id
      AND COALESCE(existing.attributes, '{}'::jsonb) = '{}'::jsonb
      AND public.normalize_variant_axis_value(existing.condition) =
        public.normalize_variant_axis_value(archive.condition)
  );

WITH archived_simple_offers AS (
  SELECT DISTINCT archive.product_id
  FROM public.product_offer_migration_archive AS archive
  WHERE archive.archive_reason = 'converted_simple_offers_to_sku_matrix'
    AND archive.source_migration = '20260415110000_prepare_legacy_products_for_sku_matrix'
)
INSERT INTO public.product_variants (
  product_id,
  merchant_id,
  attributes,
  condition,
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
  p.id,
  p.merchant_id,
  '{}'::jsonb,
  public.normalize_variant_axis_value(p.condition),
  p.price,
  p.cost_price,
  COALESCE(p.stock_quantity, p.stock, 0),
  NULLIF(trim(p.sku), ''),
  COALESCE(p.images, '[]'::jsonb),
  public.extract_primary_image_from_jsonb(COALESCE(p.images, '[]'::jsonb)),
  NOW(),
  NOW()
FROM archived_simple_offers AS candidates
JOIN public.products AS p
  ON p.id = candidates.product_id
WHERE public.normalize_variant_axis_value(p.condition) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.product_offer_migration_archive AS archive
    WHERE archive.product_id = p.id
      AND archive.archive_reason = 'converted_simple_offers_to_sku_matrix'
      AND archive.source_migration = '20260415110000_prepare_legacy_products_for_sku_matrix'
      AND public.normalize_variant_axis_value(archive.condition) =
        public.normalize_variant_axis_value(p.condition)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.product_variants AS existing
    WHERE existing.product_id = p.id
      AND COALESCE(existing.attributes, '{}'::jsonb) = '{}'::jsonb
      AND public.normalize_variant_axis_value(existing.condition) =
        public.normalize_variant_axis_value(p.condition)
  );

WITH archived_simple_offers AS (
  SELECT DISTINCT archive.product_id
  FROM public.product_offer_migration_archive AS archive
  WHERE archive.archive_reason = 'converted_simple_offers_to_sku_matrix'
    AND archive.source_migration = '20260415110000_prepare_legacy_products_for_sku_matrix'
)
DELETE FROM public.product_offers AS po
USING archived_simple_offers
WHERE po.product_id = archived_simple_offers.product_id;

WITH touched_products AS (
  SELECT DISTINCT archive.product_id AS id
  FROM public.product_offer_migration_archive AS archive
  WHERE archive.archive_reason = 'converted_simple_offers_to_sku_matrix'
    AND archive.source_migration = '20260415110000_prepare_legacy_products_for_sku_matrix'
  UNION
  SELECT DISTINCT p.id
  FROM public.products AS p
  WHERE p.condition IS NOT NULL
    AND trim(p.condition) <> ''
    AND EXISTS (
      SELECT 1
      FROM public.product_variants AS pv
      WHERE pv.product_id = p.id
        AND pv.condition IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.product_offers AS po
      WHERE po.product_id = p.id
    )
)
UPDATE public.products AS p
SET has_variants = TRUE,
    has_condition_offers = EXISTS (
      SELECT 1
      FROM public.product_offers AS po
      WHERE po.product_id = p.id
    )
FROM touched_products
WHERE p.id = touched_products.id;
