-- disable-transaction
-- Supports OgaBassey's recent-first home product grid:
-- WHERE merchant_id = ? AND status = 'active'
-- ORDER BY updated_at DESC, price DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_merchant_updated_at_active
  ON public.products USING btree (merchant_id, updated_at DESC, price DESC)
  WHERE status = 'active';

COMMENT ON INDEX public.idx_products_merchant_updated_at_active IS
  'Supports recent-first storefront home product grids for active products without tenant catalog scans.';
