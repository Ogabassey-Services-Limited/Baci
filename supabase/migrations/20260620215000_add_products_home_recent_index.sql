-- Supports OgaBassey storefront home products ordered by latest product updates.
-- The query filters by merchant/status and orders by updated_at DESC NULLS LAST,
-- then price DESC as a stable tiebreaker before applying a small homepage LIMIT.
-- Keep this transactional for Supabase migration runners; CREATE INDEX CONCURRENTLY
-- cannot run inside a transaction block.

CREATE INDEX IF NOT EXISTS idx_products_home_recent_active
  ON public.products (merchant_id, updated_at DESC NULLS LAST, price DESC)
  WHERE status = 'active';
