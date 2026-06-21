-- Speed up storefront autocomplete.
--
-- /api/search/autocomplete runs a leading-wildcard `column ILIKE '%q%'` against
-- four columns on every keystroke. Leading-wildcard ILIKE can only avoid a
-- sequential scan when a `gin_trgm_ops` index exists on the column. Today the
-- products table has trigram indexes on `name` and `category` only, so the
-- `brand` and `sku` lookups fall back to sequential scans (the route comments
-- note ~16K seq scans/day and occasional statement-timeout cancellations).
--
-- Add the two missing trigram indexes so all four autocomplete column lookups
-- are index-backed. The existing `sku` trigram index is on the expression
-- `lower(coalesce(sku, ''))`, which the planner cannot use for a plain
-- `sku ILIKE '%q%'`; a trigram index on the raw column closes that gap and is
-- case-insensitive for ILIKE.
--
-- NOTE: built non-concurrently (Supabase runs migrations in a transaction).
-- This takes a brief ShareLock on products during the build; acceptable for the
-- current catalog size.

CREATE INDEX IF NOT EXISTS "idx_products_brand_trgm"
  ON "public"."products" USING "gin" ("brand" "extensions"."gin_trgm_ops");

CREATE INDEX IF NOT EXISTS "idx_products_sku_trgm"
  ON "public"."products" USING "gin" ("sku" "extensions"."gin_trgm_ops");
