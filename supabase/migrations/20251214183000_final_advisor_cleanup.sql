-- Applied via Supabase MCP to fix final advisor errors
-- Timestamp: 2025-12-14 (Batch 4)

-- 1. Fix Remaining Unindexed Foreign Keys
CREATE INDEX IF NOT EXISTS idx_categories_parent_id_fk ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id_fk ON public.product_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_reward_id_fk ON public.reward_redemptions(reward_id);

-- 2. Drop Remaining Unused Indexes
DROP INDEX IF EXISTS idx_orders_invoice_date;
DROP INDEX IF EXISTS idx_customer_loyalty_referred_by;
