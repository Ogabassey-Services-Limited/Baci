-- disable-transaction
-- Keep proxy-level storefront product slug resolution index-backed for both
-- canonical active PDPs and archived legacy aliases.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_merchant_slug_active_archived
  ON public.products USING btree (merchant_id, slug)
  WHERE status IN ('active', 'archived');

COMMENT ON INDEX public.idx_products_merchant_slug_active_archived IS
  'Supports get_merchant_product_slug_resolution active PDP lookup and archived alias redirects without tenant catalog scans.';
