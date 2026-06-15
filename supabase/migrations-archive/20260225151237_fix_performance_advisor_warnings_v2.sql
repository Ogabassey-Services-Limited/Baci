
-- Drop 32 unused indexes
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

-- Drop redundant RLS policies (multiple_permissive_policies)
DROP POLICY IF EXISTS "Staff can view blog categories" ON public.blog_categories;
DROP POLICY IF EXISTS "Merchants and staff can insert blog categories" ON public.blog_categories;
DROP POLICY IF EXISTS "Merchants and staff can update blog categories" ON public.blog_categories;
DROP POLICY IF EXISTS "Merchants and staff can delete blog categories" ON public.blog_categories;

DROP POLICY IF EXISTS "Staff can view blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Merchants and staff can insert blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Merchants and staff can update blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Merchants and staff can delete blog posts" ON public.blog_posts;

DROP POLICY IF EXISTS "Merchants can manage their own discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Merchants can manage their loyalty rewards" ON public.loyalty_rewards;

DROP POLICY IF EXISTS "Staff can view page configs" ON public.page_configs;
DROP POLICY IF EXISTS "Merchants can insert their own page configs" ON public.page_configs;
DROP POLICY IF EXISTS "Merchants can update their own page configs" ON public.page_configs;
DROP POLICY IF EXISTS "Merchants can delete their own page configs" ON public.page_configs;

DROP POLICY IF EXISTS "product_offers_policy" ON public.product_offers;

DROP POLICY IF EXISTS "Merchants can create shipments" ON public.shipments;
DROP POLICY IF EXISTS "Merchants can update own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Merchants can delete own shipments" ON public.shipments;

DROP POLICY IF EXISTS "Merchants can manage their own ai topics" ON public.ai_generated_topics;
DROP POLICY IF EXISTS "Merchants can manage their loyalty settings" ON public.loyalty_settings;

DROP POLICY IF EXISTS "Users can view their own merchant" ON public.merchants;
DROP POLICY IF EXISTS "Users can update their own merchant" ON public.merchants;

DROP POLICY IF EXISTS "Staff can view product key specs" ON public.product_key_specs;
DROP POLICY IF EXISTS "pks_insert" ON public.product_key_specs;

DROP POLICY IF EXISTS "Staff can view product reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Merchants can moderate their reviews" ON public.product_reviews;

DROP POLICY IF EXISTS "Staff can view checkout sessions" ON public.checkout_sessions;
DROP POLICY IF EXISTS "Merchants can view their discount code usage" ON public.discount_code_usage;
DROP POLICY IF EXISTS "Merchants can view their own form submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Merchants can view their own settlements" ON public.merchant_settlements;
DROP POLICY IF EXISTS "Merchants can view their own page history" ON public.page_config_history;
DROP POLICY IF EXISTS "Merchants can view their own VTU transactions" ON public.vtu_transactions;

DROP POLICY IF EXISTS "Merchants can manage their airtime rewards" ON public.loyalty_airtime_rewards;
DROP POLICY IF EXISTS "Merchants can manage segment definitions" ON public.segment_definitions;
DROP POLICY IF EXISTS "Merchants can manage their inventory alerts" ON public.inventory_alerts;
DROP POLICY IF EXISTS "Merchants can manage reorder suggestions" ON public.reorder_suggestions;
DROP POLICY IF EXISTS "Merchants can view their customer RFM scores" ON public.customer_rfm_scores;
DROP POLICY IF EXISTS "Merchants can view their inventory snapshots" ON public.inventory_snapshots;

-- Fix auth_rls_initplan: recreate policies with (SELECT auth.uid())

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

DROP POLICY IF EXISTS "Staff can manage ai generated topics" ON public.ai_generated_topics;
CREATE POLICY "Staff can manage ai generated topics" ON public.ai_generated_topics
  FOR INSERT TO public
  WITH CHECK (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'create')
  );

DROP POLICY IF EXISTS "Staff can update loyalty settings" ON public.loyalty_settings;
CREATE POLICY "Staff can update loyalty settings" ON public.loyalty_settings
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'edit')
  );

DROP POLICY IF EXISTS "Staff can update inventory alerts" ON public.inventory_alerts;
CREATE POLICY "Staff can update inventory alerts" ON public.inventory_alerts
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'edit')
  );

DROP POLICY IF EXISTS "Staff can update reorder suggestions" ON public.reorder_suggestions;
CREATE POLICY "Staff can update reorder suggestions" ON public.reorder_suggestions
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'edit')
  );

DROP POLICY IF EXISTS "Staff can insert loyalty airtime rewards" ON public.loyalty_airtime_rewards;
CREATE POLICY "Staff can insert loyalty airtime rewards" ON public.loyalty_airtime_rewards
  FOR INSERT TO public
  WITH CHECK (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'marketing', 'create')
  );

DROP POLICY IF EXISTS "Staff can update product reviews" ON public.product_reviews;
CREATE POLICY "Staff can update product reviews" ON public.product_reviews
  FOR UPDATE TO public
  USING (
    (merchant_id IN (SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())))
    OR check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'edit')
  );
;
