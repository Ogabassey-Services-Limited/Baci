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
USING (
  ((select auth.uid()) = user_id)
  OR EXISTS (
    SELECT 1
    FROM public.staff_members sm
    WHERE sm.user_id = (select auth.uid())
      AND sm.merchant_id = merchants.id
      AND sm.status = 'active'
  )
);

-- 1b. merchants table: "Users can update their own merchant"
-- Current policy uses bare auth.uid(). Wrap in subquery for initplan optimization.
DROP POLICY IF EXISTS "Users can update their own merchant" ON public.merchants;

CREATE POLICY "Users can update their own merchant"
ON public.merchants FOR UPDATE
USING ((select auth.uid()) = user_id);

-- 1c. audit_logs table: "Users can view own audit logs"
-- Recreate with consistent (select auth.uid()) pattern.
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;

CREATE POLICY "Users can view own audit logs"
ON public.audit_logs FOR SELECT
USING ((select auth.uid()) = user_id);

-- 1d. audit_logs table: "Users can insert own audit logs"
-- Recreate with consistent (select auth.uid()) pattern.
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;

CREATE POLICY "Users can insert own audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- SECTION 2: Drop Unused Indexes (0 scans in 115 days of monitoring)
-- ============================================================================

-- Non-PK unused indexes
DROP INDEX IF EXISTS public.idx_merchants_about_page;
DROP INDEX IF EXISTS public.idx_products_brand_trgm;
DROP INDEX IF EXISTS public.branches_manager_id_idx;

-- Keep materialized view unique indexes.
-- REFRESH MATERIALIZED VIEW CONCURRENTLY depends on these unique indexes.

-- NOTE: DO NOT drop idx_orders_tracking_token (used by get_order_tracking RPC)
-- NOTE: DO NOT drop any PK indexes (required for constraint enforcement)
-- NOTE: DO NOT drop customers_merchant_phone_unique (may be a unique constraint)

-- ============================================================================
-- SECTION 3: Add Missing Foreign Key Indexes
-- Index creation moved to follow-up non-transactional migration:
--   20260221153000_add_missing_fk_indexes_concurrently.sql
-- ============================================================================

-- ============================================================================
-- SECTION 4: ANALYZE Stale Tables (refresh planner statistics)
-- These tables have stale or missing statistics, causing suboptimal query plans.
-- ============================================================================

ANALYZE public.staff_members;
ANALYZE public.notification_preferences;
ANALYZE public.segment_definitions;
ANALYZE public.merchant_agents;
ANALYZE public.platform_settings;
ANALYZE public.role_permissions;
ANALYZE public.blog_categories;
ANALYZE public.brands;
