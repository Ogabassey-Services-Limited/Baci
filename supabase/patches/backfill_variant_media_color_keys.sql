-- Backfill variant media projections after
-- 20260425012000_canonicalize_variant_media_color_keys.sql is deployed.
--
-- Run with psql and autocommit enabled so each generated refresh statement
-- runs in its own transaction instead of holding locks for the whole catalog:
--
--   psql "$DATABASE_URL" -f supabase/patches/backfill_variant_media_color_keys.sql

\set ON_ERROR_STOP on

\echo 'Starting variant media color-key projection backfill'

SELECT count(*) AS products_to_process
FROM public.products
WHERE has_variants = TRUE;

SELECT format(
  'SELECT public.refresh_product_variant_media_projection(%L::uuid);',
  id
)
FROM public.products
WHERE has_variants = TRUE
ORDER BY id
\gexec

\echo 'Finished variant media color-key projection backfill'
