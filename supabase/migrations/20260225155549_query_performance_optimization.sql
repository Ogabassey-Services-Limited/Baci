
-- Phase 1: Query Performance Optimization (2026 Best Practices)
-- 1) Re-add 30 FK indexes
-- 2) BRIN index on analytics_events.created_at
-- 3) Composite index on analytics_events for common query pattern
-- 4) Autovacuum tuning on high-churn tables
-- 5) ANALYZE hot tables

BEGIN;

-- ============================================================
-- 1. Foreign Key Indexes (CRITICAL per Supabase best practices)
--    Postgres does NOT auto-index FKs. These support JOINs,
--    ON DELETE CASCADE, and RLS policy subqueries.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ai_jobs_merchant_id ON ai_jobs (merchant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_merchant_id ON audit_logs (merchant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_branches_manager_id ON branches (manager_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_transactions_wallet_id ON customer_wallet_transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_merchant_id ON form_submissions (merchant_id);
CREATE INDEX IF NOT EXISTS idx_jumia_product_mappings_merchant_id ON jumia_product_mappings (merchant_id);
CREATE INDEX IF NOT EXISTS idx_jumia_product_mappings_variant_id ON jumia_product_mappings (variant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_agents_merchant_id ON merchant_agents (merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_settlements_wallet_id ON merchant_settlements (wallet_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_requests_merchant_id ON negotiation_requests (merchant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_template_id ON notifications (template_id);
CREATE INDEX IF NOT EXISTS idx_order_reminders_order_id ON order_reminders (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_selected_quote_id ON orders (selected_quote_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipment_id ON orders (shipment_id);
CREATE INDEX IF NOT EXISTS idx_orders_wallet_transaction_id ON orders (wallet_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_merchant_id ON payout_requests (merchant_id);
CREATE INDEX IF NOT EXISTS idx_payouts_merchant_id ON payouts (merchant_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests (order_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_reward_id ON reward_redemptions (reward_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_clicked_product_id ON search_analytics (clicked_product_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_merchant_id ON search_analytics (merchant_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments (order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_webhook_events_shipment_id ON shipping_webhook_events (shipment_id);
CREATE INDEX IF NOT EXISTS idx_variant_inventory_merchant_id ON variant_inventory (merchant_id);
CREATE INDEX IF NOT EXISTS idx_variant_inventory_variant_id ON variant_inventory (variant_id);
CREATE INDEX IF NOT EXISTS idx_virtual_terminals_branch_id ON virtual_terminals (branch_id);
CREATE INDEX IF NOT EXISTS idx_virtual_terminals_staff_id ON virtual_terminals (staff_id);
CREATE INDEX IF NOT EXISTS idx_vtu_transactions_order_id ON vtu_transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions (wallet_id);

-- ============================================================
-- 2. BRIN index on analytics_events.created_at
--    BRIN is 10-100x smaller than B-tree for time-series data.
--    Queries filtering by created_at (date range) benefit hugely.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at_brin
  ON analytics_events USING brin (created_at);

-- ============================================================
-- 3. Composite index for common analytics query pattern
--    Slow queries filter: merchant_id = X AND event_type = Y AND created_at >= Z
--    Equality columns first, range column last (per best practices)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_analytics_events_merchant_type_created
  ON analytics_events (merchant_id, event_type, created_at DESC);

-- ============================================================
-- 4. Autovacuum tuning on high-churn tables
--    analytics_events (51K rows, high insert rate) needs more
--    aggressive vacuum/analyze to keep statistics fresh.
-- ============================================================

ALTER TABLE analytics_events SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE products SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE orders SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- ============================================================
-- 5. ANALYZE hot tables to refresh planner statistics
-- ============================================================

ANALYZE analytics_events;
ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
ANALYZE blog_posts;
ANALYZE merchants;
ANALYZE customers;
ANALYZE product_variants;

COMMIT;
;
