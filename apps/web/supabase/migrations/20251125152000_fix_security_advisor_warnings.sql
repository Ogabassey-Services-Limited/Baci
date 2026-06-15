-- Fix Security Advisor Warnings
-- This migration addresses 5 security warnings:
-- 1. Secure 4 materialized views by revoking direct access and creating RLS-enabled views
-- 2. Vector extension location (INFO only - acceptable in public schema for Supabase)

-- ============================================================================
-- Fix Materialized View Security (4 warnings)
-- Materialized views don't support RLS directly, so we:
-- 1. Revoke direct access to materialized views
-- 2. Create RLS-enabled regular views that query the materialized views
-- 3. Merchants access data through the secure views
-- ============================================================================

-- Step 1: Revoke direct access to materialized views from anon and authenticated roles
REVOKE ALL ON sales_by_channel FROM anon, authenticated;
REVOKE ALL ON daily_sales_summary FROM anon, authenticated;
REVOKE ALL ON product_performance FROM anon, authenticated;
REVOKE ALL ON customer_insights FROM anon, authenticated;

-- Step 2: Create secure views that filter by merchant_id
-- Security is enforced in the view definition using auth.uid()
-- No need for additional RLS policies on views

-- Secure view for sales_by_channel
CREATE OR REPLACE VIEW secure_sales_by_channel
WITH (security_invoker = true) AS
SELECT * FROM sales_by_channel
WHERE merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
);

-- Secure view for daily_sales_summary
CREATE OR REPLACE VIEW secure_daily_sales_summary
WITH (security_invoker = true) AS
SELECT * FROM daily_sales_summary
WHERE merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
);

-- Secure view for product_performance
CREATE OR REPLACE VIEW secure_product_performance
WITH (security_invoker = true) AS
SELECT * FROM product_performance
WHERE merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
);

-- Secure view for customer_insights
CREATE OR REPLACE VIEW secure_customer_insights
WITH (security_invoker = true) AS
SELECT * FROM customer_insights
WHERE merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
);

-- Step 3: Grant access to the secure views
GRANT SELECT ON secure_sales_by_channel TO anon, authenticated;
GRANT SELECT ON secure_daily_sales_summary TO anon, authenticated;
GRANT SELECT ON secure_product_performance TO anon, authenticated;
GRANT SELECT ON secure_customer_insights TO anon, authenticated;

-- ============================================================================
-- Notes on remaining warnings:
-- ============================================================================

-- 1. Vector extension in public schema:
--    This is acceptable for Supabase. The warning is informational only.
--    Moving extensions requires superuser privileges not available via migrations.
--    Supabase manages this appropriately.

-- 2. Leaked password protection:
--    Must be enabled manually in Supabase Dashboard:
--    Authentication → Policies → Enable "Leaked Password Protection"
--    This cannot be set via SQL migration.
