-- Applied via Supabase MCP to fix remaining advisor errors
-- Timestamp: 2025-12-14 (Batch 3)

-- 1. Fix Unindexed Foreign Keys
CREATE INDEX IF NOT EXISTS idx_notifications_template_id ON public.notifications(template_id);
CREATE INDEX IF NOT EXISTS idx_vtu_transactions_customer_id ON public.vtu_transactions(customer_id);

-- 2. Drop Remaining Unused Indexes
DROP INDEX IF EXISTS idx_vtu_transactions_order;
DROP INDEX IF EXISTS idx_merchants_kyc_status;
DROP INDEX IF EXISTS idx_product_reviews_order_id;
DROP INDEX IF EXISTS idx_reward_redemptions_reward_id;
DROP INDEX IF EXISTS idx_categories_parent_id;
