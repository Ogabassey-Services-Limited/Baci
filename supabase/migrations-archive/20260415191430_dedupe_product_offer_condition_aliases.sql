-- Prevent UNIQUE(product_id, condition) violations during canonicalization by
-- removing offer rows whose alias condition would collapse onto an existing
-- canonical condition for the same product. Today the only supported alias in
-- product_offers is refurbished -> open_box.

WITH duplicate_alias_rows AS (
  SELECT alias_offer.*
  FROM public.product_offers AS alias_offer
  JOIN public.product_offers AS canonical_offer
    ON canonical_offer.product_id = alias_offer.product_id
   AND lower(trim(canonical_offer.condition)) = 'open_box'
  WHERE lower(trim(alias_offer.condition)) = 'refurbished'
),
archived_duplicates AS (
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
    archive_reason,
    source_migration
  )
  SELECT
    duplicate_alias_rows.id,
    duplicate_alias_rows.product_id,
    duplicate_alias_rows.merchant_id,
    duplicate_alias_rows.condition,
    duplicate_alias_rows.price,
    duplicate_alias_rows.compare_at_price,
    duplicate_alias_rows.stock_quantity,
    duplicate_alias_rows.images,
    duplicate_alias_rows.condition_notes,
    duplicate_alias_rows.grade,
    duplicate_alias_rows.status,
    duplicate_alias_rows.created_at,
    duplicate_alias_rows.updated_at,
    'deduped_condition_alias_before_canonicalization',
    '20260415191430_dedupe_product_offer_condition_aliases'
  FROM duplicate_alias_rows
  ON CONFLICT (offer_id) DO NOTHING
  RETURNING offer_id
)
DELETE FROM public.product_offers AS product_offers
USING archived_duplicates
WHERE product_offers.id = archived_duplicates.offer_id;
