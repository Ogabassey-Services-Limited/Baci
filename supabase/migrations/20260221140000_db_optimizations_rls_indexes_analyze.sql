-- Migration: Database Optimizations (RLS policies, unused indexes, missing FK indexes, ANALYZE)
-- Date: 2026-02-21
-- Description:
--   1. Fix RLS policies on merchants and audit_logs to use (select auth.uid()) subquery pattern
--   2. Drop unused indexes (0 scans in 115 days)
--   3. Add missing indexes on foreign key columns
--   4. ANALYZE stale tables to refresh planner statistics
--
-- Rollback instructions:
--   Section 1: Recreate old policies with bare auth.uid() calls
--   Section 2: Recreate dropped indexes (see original CREATE statements in referenced migrations)
--   Section 3: DROP INDEX IF EXISTS for each new index
--   Section 4: No rollback needed (ANALYZE is non-destructive)

-- ============================================================================
-- SECTION 1: Fix RLS Policies (subquery-wrapped auth.uid() to prevent per-row re-evaluation)
-- ============================================================================

-- 1a. merchants table: "Users can view their own merchant"
-- Current policy uses get_user_merchant_access() function. Replace with direct user_id check
-- using (select auth.uid()) to avoid per-row function call overhead (1.4M seq scans observed).
DROP POLICY IF EXISTS "Users can view their own merchant" ON public.merchants;

CREATE POLICY "Users can view their own merchant"
ON public.merchants FOR SELECT
USING ((select auth.uid()) = user_id);

-- 1b. merchants table: "Users can update their own merchant"
-- Current policy uses bare auth.uid(). Wrap in subquery for initplan optimization.
DROP POLICY IF EXISTS "Users can update their own merchant" ON public.merchants;

CREATE POLICY "Users can update their own merchant"
ON public.merchants FOR UPDATE
USING ((select auth.uid()) = user_id);

-- 1c. audit_logs table: "Users can view own audit logs"
-- Recreate with consistent (select auth.uid()) pattern.
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;

CREATE POLICY "Users can view own audit logs"
ON audit_logs FOR SELECT
USING ((select auth.uid()) = user_id);

-- 1d. audit_logs table: "Users can insert own audit logs"
-- Recreate with consistent (select auth.uid()) pattern.
DROP POLICY IF EXISTS "Users can insert own audit logs" ON audit_logs;

CREATE POLICY "Users can insert own audit logs"
ON audit_logs FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- SECTION 2: Drop Unused Indexes (0 scans in 115 days of monitoring)
-- ============================================================================

-- Non-PK unused indexes
DROP INDEX IF EXISTS idx_merchants_about_page;
DROP INDEX IF EXISTS idx_products_brand_trgm;
DROP INDEX IF EXISTS branches_manager_id_idx;

-- Materialized view concurrent refresh indexes (0 scans, rarely refreshed)
DROP INDEX IF EXISTS idx_customer_insights_unique;
DROP INDEX IF EXISTS idx_platform_growth_month;
DROP INDEX IF EXISTS top_merchants_merchant_id_idx;

-- NOTE: DO NOT drop idx_orders_tracking_token (used by get_order_tracking RPC)
-- NOTE: DO NOT drop any PK indexes (required for constraint enforcement)
-- NOTE: DO NOT drop customers_merchant_phone_unique (may be a unique constraint)

-- ============================================================================
-- SECTION 3: Add Missing Foreign Key Indexes
-- Using regular CREATE INDEX (not CONCURRENTLY) since these tables are empty/tiny
-- and the migration runs inside a transaction.
-- Partial indexes with WHERE ... IS NOT NULL to skip null FK values.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_reward_id
    ON public.reward_redemptions(reward_id)
    WHERE reward_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_negotiation_customer
    ON public.negotiation_requests(customer_id)
    WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jumia_product_mappings_variant
    ON public.jumia_product_mappings(variant_id)
    WHERE variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jumia_orders_baci_order_id
    ON public.jumia_orders(baci_order_id)
    WHERE baci_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipping_webhook_shipment_id
    ON public.shipping_webhook_events(shipment_id)
    WHERE shipment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shipment_id
    ON public.orders(shipment_id)
    WHERE shipment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_selected_quote_id
    ON public.orders(selected_quote_id)
    WHERE selected_quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_order_id
    ON public.reward_redemptions(used_on_order_id)
    WHERE used_on_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_variant_inventory_order_id
    ON public.variant_inventory(order_id)
    WHERE order_id IS NOT NULL;

-- ============================================================================
-- SECTION 4: ANALYZE Stale Tables (refresh planner statistics)
-- These tables have stale or missing statistics, causing suboptimal query plans.
-- ============================================================================

ANALYZE staff_members;
ANALYZE notification_preferences;
ANALYZE segment_definitions;
ANALYZE merchant_agents;
ANALYZE platform_settings;
ANALYZE role_permissions;
ANALYZE blog_categories;
ANALYZE brands;
