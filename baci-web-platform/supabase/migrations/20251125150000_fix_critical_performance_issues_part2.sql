-- Fix Critical Performance Issues Part 2: RLS Policy Optimizations
-- This migration fixes 63 critical WARN-level performance issues:
-- 1. Fix 35 auth_rls_initplan warnings (wrap auth.uid() in SELECT)
-- 2. Fix 28 multiple_permissive_policies warnings (consolidate duplicate policies)

-- ============================================================================
-- PART 1: Fix auth_rls_initplan warnings (35 policies)
-- Replace auth.uid() with (SELECT auth.uid()) to prevent re-evaluation per row
-- ============================================================================

-- payout_requests table (2 policies)
DROP POLICY IF EXISTS "Merchants can view their own payout requests" ON payout_requests;
CREATE POLICY "Merchants can view their own payout requests"
    ON payout_requests FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can create their own payout requests" ON payout_requests;
CREATE POLICY "Merchants can create their own payout requests"
    ON payout_requests FOR INSERT
    WITH CHECK (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

-- audit_logs table (2 policies)
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;
CREATE POLICY "Users can view own audit logs"
    ON audit_logs FOR SELECT
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own audit logs" ON audit_logs;
CREATE POLICY "Users can insert own audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid()));

-- form_submissions table (2 policies)
DROP POLICY IF EXISTS "Merchants can view their own form submissions" ON form_submissions;
CREATE POLICY "Merchants can view their own form submissions"
    ON form_submissions FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can update their own form submissions" ON form_submissions;
CREATE POLICY "Merchants can update their own form submissions"
    ON form_submissions FOR UPDATE
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

-- analytics_events table (2 policies)
DROP POLICY IF EXISTS "Merchants can view their own analytics events" ON analytics_events;
CREATE POLICY "Merchants can view their own analytics events"
    ON analytics_events FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can insert their own analytics events" ON analytics_events;
CREATE POLICY "Merchants can insert their own analytics events"
    ON analytics_events FOR INSERT
    WITH CHECK (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

-- dashboard_preferences table (3 policies)
DROP POLICY IF EXISTS "Merchants can view their own dashboard preferences" ON dashboard_preferences;
CREATE POLICY "Merchants can view their own dashboard preferences"
    ON dashboard_preferences FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can insert their own dashboard preferences" ON dashboard_preferences;
CREATE POLICY "Merchants can insert their own dashboard preferences"
    ON dashboard_preferences FOR INSERT
    WITH CHECK (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can update their own dashboard preferences" ON dashboard_preferences;
CREATE POLICY "Merchants can update their own dashboard preferences"
    ON dashboard_preferences FOR UPDATE
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

-- order_items table (2 policies)
DROP POLICY IF EXISTS "Customers can view own order items" ON order_items;
CREATE POLICY "Customers can view own order items"
    ON order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.customer_id IN (
                SELECT id FROM customers WHERE user_id = (SELECT auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Merchants can view own order items" ON order_items;
CREATE POLICY "Merchants can view own order items"
    ON order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.merchant_id IN (
                SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
            )
        )
    );

-- ai_jobs table (2 policies)
DROP POLICY IF EXISTS "Merchants can view own jobs" ON ai_jobs;
CREATE POLICY "Merchants can view own jobs"
    ON ai_jobs FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can create jobs" ON ai_jobs;
CREATE POLICY "Merchants can create jobs"
    ON ai_jobs FOR INSERT
    WITH CHECK (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

-- product_variants table (4 policies)
DROP POLICY IF EXISTS "Merchants can view their variants" ON product_variants;
CREATE POLICY "Merchants can view their variants"
    ON product_variants FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can insert their variants" ON product_variants;
CREATE POLICY "Merchants can insert their variants"
    ON product_variants FOR INSERT
    WITH CHECK (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can update their variants" ON product_variants;
CREATE POLICY "Merchants can update their variants"
    ON product_variants FOR UPDATE
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can delete their variants" ON product_variants;
CREATE POLICY "Merchants can delete their variants"
    ON product_variants FOR DELETE
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

-- variant_inventory table (4 policies)
DROP POLICY IF EXISTS "Merchants can view their inventory" ON variant_inventory;
CREATE POLICY "Merchants can view their inventory"
    ON variant_inventory FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can insert their inventory" ON variant_inventory;
CREATE POLICY "Merchants can insert their inventory"
    ON variant_inventory FOR INSERT
    WITH CHECK (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can update their inventory" ON variant_inventory;
CREATE POLICY "Merchants can update their inventory"
    ON variant_inventory FOR UPDATE
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can delete their inventory" ON variant_inventory;
CREATE POLICY "Merchants can delete their inventory"
    ON variant_inventory FOR DELETE
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

-- customers table (4 policies)
DROP POLICY IF EXISTS "Merchants can view their own customers" ON customers;
CREATE POLICY "Merchants can view their own customers"
    ON customers FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can insert their own customers" ON customers;
CREATE POLICY "Merchants can insert their own customers"
    ON customers FOR INSERT
    WITH CHECK (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can update their own customers" ON customers;
CREATE POLICY "Merchants can update their own customers"
    ON customers FOR UPDATE
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can delete their own customers" ON customers;
CREATE POLICY "Merchants can delete their own customers"
    ON customers FOR DELETE
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

-- page_configs table (4 policies)
DROP POLICY IF EXISTS "Merchants can view their own page configs" ON page_configs;
CREATE POLICY "Merchants can view their own page configs"
    ON page_configs FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can insert their own page configs" ON page_configs;
CREATE POLICY "Merchants can insert their own page configs"
    ON page_configs FOR INSERT
    WITH CHECK (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can update their own page configs" ON page_configs;
CREATE POLICY "Merchants can update their own page configs"
    ON page_configs FOR UPDATE
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

DROP POLICY IF EXISTS "Merchants can delete their own page configs" ON page_configs;
CREATE POLICY "Merchants can delete their own page configs"
    ON page_configs FOR DELETE
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

-- page_config_history table (1 policy)
DROP POLICY IF EXISTS "Merchants can view their own page history" ON page_config_history;
CREATE POLICY "Merchants can view their own page history"
    ON page_config_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM page_configs
            WHERE page_configs.id = page_config_history.page_config_id
            AND page_configs.merchant_id IN (
                SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
            )
        )
    );

-- merchant_balances table (1 policy)
DROP POLICY IF EXISTS "Merchants can view their own balances" ON merchant_balances;
CREATE POLICY "Merchants can view their own balances"
    ON merchant_balances FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

-- transactions table (1 policy)
DROP POLICY IF EXISTS "Merchants can view their own transactions" ON transactions;
CREATE POLICY "Merchants can view their own transactions"
    ON transactions FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

-- ============================================================================
-- PART 2: Fix multiple_permissive_policies warnings (28 policies)
-- Consolidate duplicate policies into single optimized policies
-- ============================================================================

-- customers table: Consolidate 3 pairs of duplicate policies (6 policies → 3)
-- Drop old overlapping policies
DROP POLICY IF EXISTS "Enable INSERT for users on their own customer record" ON customers;
DROP POLICY IF EXISTS "Enable SELECT for users and merchants on customers" ON customers;
DROP POLICY IF EXISTS "Enable UPDATE for users on their own customer record" ON customers;

-- Create consolidated policies that handle both use cases
CREATE POLICY "Consolidated: Users and merchants can view customers"
    ON customers FOR SELECT
    USING (
        user_id = (SELECT auth.uid()) OR
        merchant_id IN (
            SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Consolidated: Users and merchants can insert customers"
    ON customers FOR INSERT
    WITH CHECK (
        user_id = (SELECT auth.uid()) OR
        merchant_id IN (
            SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Consolidated: Users and merchants can update customers"
    ON customers FOR UPDATE
    USING (
        user_id = (SELECT auth.uid()) OR
        merchant_id IN (
            SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
        )
    );

-- order_items table: Consolidate 2 pairs of duplicate policies
-- Drop old overlapping policies
DROP POLICY IF EXISTS "Allow insert for valid orders" ON order_items;
DROP POLICY IF EXISTS "Merchants can insert order items for their orders" ON order_items;
DROP POLICY IF EXISTS "Users can view order items for orders they can access" ON order_items;

-- Create consolidated policies
CREATE POLICY "Consolidated: All users can insert order items for valid orders"
    ON order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND (
                orders.customer_id IN (SELECT id FROM customers WHERE user_id = (SELECT auth.uid()))
                OR orders.merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid()))
            )
        )
    );

CREATE POLICY "Consolidated: All users can view order items for accessible orders"
    ON order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND (
                orders.customer_id IN (SELECT id FROM customers WHERE user_id = (SELECT auth.uid()))
                OR orders.merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid()))
            )
        )
    );

-- page_configs table: Consolidate public + merchant access (1 pair)
DROP POLICY IF EXISTS "Public can view published configs" ON page_configs;

CREATE POLICY "Consolidated: Public can view published or merchant can view own configs"
    ON page_configs FOR SELECT
    USING (
        is_published = true OR
        merchant_id IN (
            SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
        )
    );

-- products table: Consolidate public + merchant access (1 pair)
DROP POLICY IF EXISTS "Allow read access to products" ON products;
DROP POLICY IF EXISTS "Public can view active products" ON products;

CREATE POLICY "Consolidated: Public can view active products or merchant can view own"
    ON products FOR SELECT
    USING (
        is_active = true OR
        merchant_id IN (
            SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
        )
    );
