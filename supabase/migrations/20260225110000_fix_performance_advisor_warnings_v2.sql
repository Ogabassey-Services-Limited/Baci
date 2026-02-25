-- Migration: Fix 259 Supabase Performance Advisor Warnings
-- Created: 2026-02-25
-- Categories:
--   Part 1: Drop 32 unused indexes
--   Part 2: Fix multiple_permissive_policies (223 warnings) — drop redundant RLS policies
--   Part 3: Fix auth_rls_initplan (36 warnings) — wrap auth.uid() in (SELECT auth.uid())

BEGIN;

-- =============================================================================
-- PART 1: Drop 32 unused indexes
-- =============================================================================

DROP INDEX IF EXISTS public.idx_orders_tracking_token;
DROP INDEX IF EXISTS public.idx_ai_jobs_merchant_id;
DROP INDEX IF EXISTS public.idx_audit_logs_merchant_id;
DROP INDEX IF EXISTS public.idx_audit_logs_user_id;
DROP INDEX IF EXISTS public.idx_branches_manager_id;
DROP INDEX IF EXISTS public.idx_categories_parent_id;
DROP INDEX IF EXISTS public.idx_customer_wallet_transactions_wallet_id;
DROP INDEX IF EXISTS public.idx_form_submissions_merchant_id;
DROP INDEX IF EXISTS public.idx_jumia_product_mappings_merchant_id;
DROP INDEX IF EXISTS public.idx_jumia_product_mappings_variant_id;
DROP INDEX IF EXISTS public.idx_merchant_agents_merchant_id;
DROP INDEX IF EXISTS public.idx_merchant_settlements_wallet_id;
DROP INDEX IF EXISTS public.idx_negotiation_requests_merchant_id;
DROP INDEX IF EXISTS public.idx_notifications_template_id;
DROP INDEX IF EXISTS public.idx_order_reminders_order_id;
DROP INDEX IF EXISTS public.idx_orders_selected_quote_id;
DROP INDEX IF EXISTS public.idx_reward_redemptions_reward_id;
DROP INDEX IF EXISTS public.idx_search_analytics_clicked_product_id;
DROP INDEX IF EXISTS public.idx_orders_shipment_id;
DROP INDEX IF EXISTS public.idx_orders_wallet_transaction_id;
DROP INDEX IF EXISTS public.idx_payout_requests_merchant_id;
DROP INDEX IF EXISTS public.idx_payouts_merchant_id;
DROP INDEX IF EXISTS public.idx_return_requests_order_id;
DROP INDEX IF EXISTS public.idx_search_analytics_merchant_id;
DROP INDEX IF EXISTS public.idx_shipments_order_id;
DROP INDEX IF EXISTS public.idx_shipping_webhook_events_shipment_id;
DROP INDEX IF EXISTS public.idx_variant_inventory_merchant_id;
DROP INDEX IF EXISTS public.idx_variant_inventory_variant_id;
DROP INDEX IF EXISTS public.idx_virtual_terminals_branch_id;
DROP INDEX IF EXISTS public.idx_virtual_terminals_staff_id;
DROP INDEX IF EXISTS public.idx_vtu_transactions_order_id;
DROP INDEX IF EXISTS public.idx_wallet_transactions_wallet_id;


-- =============================================================================
-- PART 2: Fix multiple_permissive_policies — drop redundant RLS policies
-- Strategy: When a table has duplicate PERMISSIVE policies for the same CMD,
-- keep the broader/newer one (staff policy with has_merchant_access or
-- check_staff_permission which includes owner access) and drop the old one.
-- =============================================================================

-- ---- blog_categories (20 warnings) ----
-- Has "Unified view access" (qual=true) for SELECT → "Staff can view" is redundant
DROP POLICY IF EXISTS "Staff can view blog categories" ON public.blog_categories;
-- Has "Merchants and staff can ..." (old) + "Staff can ..." (new) for INSERT/UPDATE/DELETE
-- The new "Staff can ..." includes OR check_staff_permission which covers both
DROP POLICY IF EXISTS "Merchants and staff can insert blog categories" ON public.blog_categories;
DROP POLICY IF EXISTS "Merchants and staff can update blog categories" ON public.blog_categories;
DROP POLICY IF EXISTS "Merchants and staff can delete blog categories" ON public.blog_categories;

-- ---- blog_posts (20 warnings) ----
DROP POLICY IF EXISTS "Staff can view blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Merchants and staff can insert blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Merchants and staff can update blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Merchants and staff can delete blog posts" ON public.blog_posts;

-- ---- discount_codes (20 warnings) ----
-- Has "Merchants can manage" (ALL) which covers SELECT/INSERT/UPDATE/DELETE for owner
-- Plus granular "Staff can ..." per-CMD — the ALL + Staff creates duplicates for each CMD
-- Drop the ALL policy, keep granular staff policies (they include owner via OR)
DROP POLICY IF EXISTS "Merchants can manage their own discount codes" ON public.discount_codes;

-- ---- loyalty_rewards (20 warnings) ----
DROP POLICY IF EXISTS "Merchants can manage their loyalty rewards" ON public.loyalty_rewards;

-- ---- page_configs (20 warnings) ----
-- Has "Consolidated: Public can view published or merchant can view ow" for SELECT
-- + "Staff can view page configs" — staff one is redundant since consolidated covers it
DROP POLICY IF EXISTS "Staff can view page configs" ON public.page_configs;
-- Old merchant-only policies + new staff policies for INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Merchants can insert their own page configs" ON public.page_configs;
DROP POLICY IF EXISTS "Merchants can update their own page configs" ON public.page_configs;
DROP POLICY IF EXISTS "Merchants can delete their own page configs" ON public.page_configs;

-- ---- product_offers (20 warnings) ----
-- Has "product_offers_policy" (ALL) + granular staff policies
DROP POLICY IF EXISTS "product_offers_policy" ON public.product_offers;

-- ---- shipments (15 warnings) ----
-- Has merchant-only + staff policies for INSERT/UPDATE, + duplicate SELECTs
DROP POLICY IF EXISTS "Merchants can create shipments" ON public.shipments;
DROP POLICY IF EXISTS "Merchants can update own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Merchants can delete own shipments" ON public.shipments;

-- ---- ai_generated_topics (10 warnings) ----
-- Has "Merchants can manage" (ALL) + "Staff can manage" (INSERT) + "Staff can view" (SELECT)
-- The ALL already covers owner; staff policies add staff access
-- Drop the ALL, keep staff granular
DROP POLICY IF EXISTS "Merchants can manage their own ai topics" ON public.ai_generated_topics;

-- ---- loyalty_settings (10 warnings) ----
DROP POLICY IF EXISTS "Merchants can manage their loyalty settings" ON public.loyalty_settings;

-- ---- merchants (10 warnings) ----
-- "Users can view their own merchant" is redundant with "Consolidated view permissions"
DROP POLICY IF EXISTS "Users can view their own merchant" ON public.merchants;
-- "Users can update their own merchant" is redundant with "Consolidated update permissions"
DROP POLICY IF EXISTS "Users can update their own merchant" ON public.merchants;

-- ---- product_key_specs (10 warnings) ----
-- Has "pks_select" (qual=true) + "Staff can view" → drop staff (true already allows all)
DROP POLICY IF EXISTS "Staff can view product key specs" ON public.product_key_specs;
-- Has "pks_insert" + "Staff can insert" → drop old pks_insert
DROP POLICY IF EXISTS "pks_insert" ON public.product_key_specs;

-- ---- product_reviews (6 warnings) ----
-- Has "Unified view access for reviews" + "Staff can view" → drop staff
DROP POLICY IF EXISTS "Staff can view product reviews" ON public.product_reviews;
-- Has "Merchants can moderate their reviews" + "Staff can update" for UPDATE
DROP POLICY IF EXISTS "Merchants can moderate their reviews" ON public.product_reviews;

-- ---- checkout_sessions (5 warnings) ----
-- Has "Allow public read by session_id" (qual=true) + "Staff can view" → drop staff
DROP POLICY IF EXISTS "Staff can view checkout sessions" ON public.checkout_sessions;

-- ---- discount_code_usage (5 warnings) ----
-- Has merchant-specific + staff SELECT → keep staff (uses has_merchant_access)
DROP POLICY IF EXISTS "Merchants can view their discount code usage" ON public.discount_code_usage;

-- ---- form_submissions (5 warnings) ----
-- Has merchant + staff SELECT → keep staff
DROP POLICY IF EXISTS "Merchants can view their own form submissions" ON public.form_submissions;
-- Has merchant UPDATE only → keep it (no staff update policy exists for overlap)

-- ---- merchant_settlements (5 warnings) ----
DROP POLICY IF EXISTS "Merchants can view their own settlements" ON public.merchant_settlements;

-- ---- page_config_history (5 warnings) ----
DROP POLICY IF EXISTS "Merchants can view their own page history" ON public.page_config_history;

-- ---- vtu_transactions (5 warnings) ----
-- Has merchant SELECT + staff SELECT → keep staff
DROP POLICY IF EXISTS "Merchants can view their own VTU transactions" ON public.vtu_transactions;

-- ---- loyalty_airtime_rewards (3 warnings) ----
-- Has "Merchants can manage" (ALL) + "Staff can insert" + "Staff can view" + "Public can view"
DROP POLICY IF EXISTS "Merchants can manage their airtime rewards" ON public.loyalty_airtime_rewards;

-- ---- segment_definitions (3 warnings) ----
DROP POLICY IF EXISTS "Merchants can manage segment definitions" ON public.segment_definitions;

-- ---- inventory_alerts (2 warnings) ----
DROP POLICY IF EXISTS "Merchants can manage their inventory alerts" ON public.inventory_alerts;

-- ---- reorder_suggestions (2 warnings) ----
DROP POLICY IF EXISTS "Merchants can manage reorder suggestions" ON public.reorder_suggestions;

-- ---- customer_rfm_scores (1 warning) ----
-- Has "Merchants can view" + "Staff can view" → keep staff
DROP POLICY IF EXISTS "Merchants can view their customer RFM scores" ON public.customer_rfm_scores;

-- ---- inventory_snapshots (1 warning) ----
DROP POLICY IF EXISTS "Merchants can view their inventory snapshots" ON public.inventory_snapshots;


-- =============================================================================
-- PART 3: Fix auth_rls_initplan — wrap bare auth.uid() in (SELECT auth.uid())
-- This ensures auth.uid() is evaluated once per query (initplan) not per row.
-- We drop and recreate the affected policies with the fix applied.
-- =============================================================================

-- ---- blog_categories: Staff INSERT/UPDATE/DELETE ----
DROP POLICY IF EXISTS "Staff can insert blog categories" ON public.blog_categories;
CREATE POLICY "Staff can insert blog categories" ON public.blog_categories
  FOR INSERT TO public
  WITH CHECK (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'create')
  );

DROP POLICY IF EXISTS "Staff can update blog categories" ON public.blog_categories;
CREATE POLICY "Staff can update blog categories" ON public.blog_categories
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'edit')
  );

DROP POLICY IF EXISTS "Staff can delete blog categories" ON public.blog_categories;
CREATE POLICY "Staff can delete blog categories" ON public.blog_categories
  FOR DELETE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'delete')
  );

-- ---- blog_posts: Staff INSERT/UPDATE/DELETE ----
DROP POLICY IF EXISTS "Staff can insert blog posts" ON public.blog_posts;
CREATE POLICY "Staff can insert blog posts" ON public.blog_posts
  FOR INSERT TO public
  WITH CHECK (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'create')
  );

DROP POLICY IF EXISTS "Staff can update blog posts" ON public.blog_posts;
CREATE POLICY "Staff can update blog posts" ON public.blog_posts
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'edit')
  );

DROP POLICY IF EXISTS "Staff can delete blog posts" ON public.blog_posts;
CREATE POLICY "Staff can delete blog posts" ON public.blog_posts
  FOR DELETE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'delete')
  );

-- ---- discount_codes: Staff INSERT/SELECT/UPDATE/DELETE ----
DROP POLICY IF EXISTS "Staff can insert discount codes" ON public.discount_codes;
CREATE POLICY "Staff can insert discount codes" ON public.discount_codes
  FOR INSERT TO public
  WITH CHECK (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'create')
  );

DROP POLICY IF EXISTS "Staff can view discount codes" ON public.discount_codes;
CREATE POLICY "Staff can view discount codes" ON public.discount_codes
  FOR SELECT TO public
  USING (has_merchant_access(merchant_id));

DROP POLICY IF EXISTS "Staff can update discount codes" ON public.discount_codes;
CREATE POLICY "Staff can update discount codes" ON public.discount_codes
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'edit')
  );

DROP POLICY IF EXISTS "Staff can delete discount codes" ON public.discount_codes;
CREATE POLICY "Staff can delete discount codes" ON public.discount_codes
  FOR DELETE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'delete')
  );

-- ---- page_configs: Staff INSERT/UPDATE/DELETE ----
DROP POLICY IF EXISTS "Staff can insert page configs" ON public.page_configs;
CREATE POLICY "Staff can insert page configs" ON public.page_configs
  FOR INSERT TO public
  WITH CHECK (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'pages', 'create')
  );

DROP POLICY IF EXISTS "Staff can update page configs" ON public.page_configs;
CREATE POLICY "Staff can update page configs" ON public.page_configs
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'pages', 'edit')
  );

DROP POLICY IF EXISTS "Staff can delete page configs" ON public.page_configs;
CREATE POLICY "Staff can delete page configs" ON public.page_configs
  FOR DELETE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'pages', 'delete')
  );

-- ---- loyalty_rewards: Staff INSERT/UPDATE/DELETE ----
DROP POLICY IF EXISTS "Staff can insert loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "Staff can insert loyalty rewards" ON public.loyalty_rewards
  FOR INSERT TO public
  WITH CHECK (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'create')
  );

DROP POLICY IF EXISTS "Staff can view loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "Staff can view loyalty rewards" ON public.loyalty_rewards
  FOR SELECT TO public
  USING (has_merchant_access(merchant_id));

DROP POLICY IF EXISTS "Staff can update loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "Staff can update loyalty rewards" ON public.loyalty_rewards
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'edit')
  );

DROP POLICY IF EXISTS "Staff can delete loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "Staff can delete loyalty rewards" ON public.loyalty_rewards
  FOR DELETE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'delete')
  );

-- ---- product_offers: Staff INSERT/SELECT/UPDATE/DELETE ----
DROP POLICY IF EXISTS "Staff can insert product offers" ON public.product_offers;
CREATE POLICY "Staff can insert product offers" ON public.product_offers
  FOR INSERT TO public
  WITH CHECK (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'create')
  );

DROP POLICY IF EXISTS "Staff can view product offers" ON public.product_offers;
CREATE POLICY "Staff can view product offers" ON public.product_offers
  FOR SELECT TO public
  USING (has_merchant_access(merchant_id));

DROP POLICY IF EXISTS "Staff can update product offers" ON public.product_offers;
CREATE POLICY "Staff can update product offers" ON public.product_offers
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'edit')
  );

DROP POLICY IF EXISTS "Staff can delete product offers" ON public.product_offers;
CREATE POLICY "Staff can delete product offers" ON public.product_offers
  FOR DELETE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'delete')
  );

-- ---- product_key_specs: Staff INSERT/UPDATE/DELETE ----
DROP POLICY IF EXISTS "Staff can insert product key specs" ON public.product_key_specs;
CREATE POLICY "Staff can insert product key specs" ON public.product_key_specs
  FOR INSERT TO public
  WITH CHECK (
    EXISTS (SELECT 1 FROM products p
      WHERE p.id = product_key_specs.product_id
      AND ((p.merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
        OR check_staff_permission((SELECT auth.uid()), p.merchant_id, 'products', 'create')))
  );

DROP POLICY IF EXISTS "Staff can update product key specs" ON public.product_key_specs;
CREATE POLICY "Staff can update product key specs" ON public.product_key_specs
  FOR UPDATE TO public
  USING (
    EXISTS (SELECT 1 FROM products p
      WHERE p.id = product_key_specs.product_id
      AND ((p.merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
        OR check_staff_permission((SELECT auth.uid()), p.merchant_id, 'products', 'edit')))
  );

DROP POLICY IF EXISTS "Staff can delete product key specs" ON public.product_key_specs;
CREATE POLICY "Staff can delete product key specs" ON public.product_key_specs
  FOR DELETE TO public
  USING (
    EXISTS (SELECT 1 FROM products p
      WHERE p.id = product_key_specs.product_id
      AND ((p.merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
        OR check_staff_permission((SELECT auth.uid()), p.merchant_id, 'products', 'delete')))
  );

-- ---- shipments: Staff INSERT/UPDATE ----
DROP POLICY IF EXISTS "Staff can insert shipments" ON public.shipments;
CREATE POLICY "Staff can insert shipments" ON public.shipments
  FOR INSERT TO public
  WITH CHECK (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'orders', 'create')
  );

DROP POLICY IF EXISTS "Staff can update shipments" ON public.shipments;
CREATE POLICY "Staff can update shipments" ON public.shipments
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'orders', 'edit')
  );

-- ---- segment_definitions: Staff INSERT/UPDATE ----
DROP POLICY IF EXISTS "Staff can insert segment definitions" ON public.segment_definitions;
CREATE POLICY "Staff can insert segment definitions" ON public.segment_definitions
  FOR INSERT TO public
  WITH CHECK (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'customers', 'create')
  );

DROP POLICY IF EXISTS "Staff can update segment definitions" ON public.segment_definitions;
CREATE POLICY "Staff can update segment definitions" ON public.segment_definitions
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'customers', 'edit')
  );

-- ---- ai_generated_topics: Staff INSERT ----
DROP POLICY IF EXISTS "Staff can manage ai generated topics" ON public.ai_generated_topics;
CREATE POLICY "Staff can manage ai generated topics" ON public.ai_generated_topics
  FOR INSERT TO public
  WITH CHECK (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'create')
  );

-- ---- loyalty_settings: Staff UPDATE ----
DROP POLICY IF EXISTS "Staff can update loyalty settings" ON public.loyalty_settings;
CREATE POLICY "Staff can update loyalty settings" ON public.loyalty_settings
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'edit')
  );

-- ---- inventory_alerts: Staff UPDATE ----
DROP POLICY IF EXISTS "Staff can update inventory alerts" ON public.inventory_alerts;
CREATE POLICY "Staff can update inventory alerts" ON public.inventory_alerts
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'edit')
  );

-- ---- reorder_suggestions: Staff UPDATE ----
DROP POLICY IF EXISTS "Staff can update reorder suggestions" ON public.reorder_suggestions;
CREATE POLICY "Staff can update reorder suggestions" ON public.reorder_suggestions
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'edit')
  );

-- ---- loyalty_airtime_rewards: Staff INSERT ----
DROP POLICY IF EXISTS "Staff can insert loyalty airtime rewards" ON public.loyalty_airtime_rewards;
CREATE POLICY "Staff can insert loyalty airtime rewards" ON public.loyalty_airtime_rewards
  FOR INSERT TO public
  WITH CHECK (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'create')
  );

-- ---- product_reviews: Staff UPDATE ----
DROP POLICY IF EXISTS "Staff can update product reviews" ON public.product_reviews;
CREATE POLICY "Staff can update product reviews" ON public.product_reviews
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'edit')
  );

-- ---- return_requests: check existing policies with bare auth.uid() ----
-- Drop and recreate if exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'return_requests'
    AND policyname = 'Staff can view return requests'
  ) THEN
    DROP POLICY "Staff can view return requests" ON public.return_requests;
    CREATE POLICY "Staff can view return requests" ON public.return_requests
      FOR SELECT TO public
      USING (has_merchant_access(merchant_id));
  END IF;
END $$;

-- ---- order_reminders: fix auth.uid() initplan ----
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_reminders'
    AND policyname = 'Staff can insert order reminders'
  ) THEN
    DROP POLICY "Staff can insert order reminders" ON public.order_reminders;
    CREATE POLICY "Staff can insert order reminders" ON public.order_reminders
      FOR INSERT TO public
      WITH CHECK (
        (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
        OR check_staff_permission((SELECT auth.uid()), merchant_id, 'orders', 'create')
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_reminders'
    AND policyname = 'Staff can update order reminders'
  ) THEN
    DROP POLICY "Staff can update order reminders" ON public.order_reminders;
    CREATE POLICY "Staff can update order reminders" ON public.order_reminders
      FOR UPDATE TO public
      USING (
        (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
        OR check_staff_permission((SELECT auth.uid()), merchant_id, 'orders', 'edit')
      );
  END IF;
END $$;

-- ---- order_payment_accounts: fix auth.uid() initplan ----
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_payment_accounts'
    AND policyname = 'Staff can insert order payment accounts'
  ) THEN
    DROP POLICY "Staff can insert order payment accounts" ON public.order_payment_accounts;
    CREATE POLICY "Staff can insert order payment accounts" ON public.order_payment_accounts
      FOR INSERT TO public
      WITH CHECK (
        (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
        OR check_staff_permission((SELECT auth.uid()), merchant_id, 'orders', 'create')
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_payment_accounts'
    AND policyname = 'Staff can update order payment accounts'
  ) THEN
    DROP POLICY "Staff can update order payment accounts" ON public.order_payment_accounts;
    CREATE POLICY "Staff can update order payment accounts" ON public.order_payment_accounts
      FOR UPDATE TO public
      USING (
        (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
        OR check_staff_permission((SELECT auth.uid()), merchant_id, 'orders', 'edit')
      );
  END IF;
END $$;

COMMIT;
