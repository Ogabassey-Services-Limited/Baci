-- disable-transaction
-- The storefront preflight RPCs (20260706200000) match product slugs
-- case-insensitively (lower(p.slug) = lowered input, mirroring the slug set's
-- case-insensitive scan), which the raw (merchant_id, slug) indexes cannot
-- seek. This expression index restores an index seek per lookup so large
-- catalogs never pay a per-tenant partition scan under the anon role's
-- statement_timeout cap.
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_products_merchant_lower_slug_active_archived
  ON public.products (merchant_id, lower(slug))
  WHERE status = ANY (ARRAY['active'::text, 'archived'::text]);

COMMENT ON INDEX public.idx_products_merchant_lower_slug_active_archived IS
  'Case-insensitive PDP slug seek for the storefront preflight RPCs (get_storefront_pdp_preflight).';
