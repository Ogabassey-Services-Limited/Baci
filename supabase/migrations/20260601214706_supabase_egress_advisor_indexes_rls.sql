-- Reduce Supabase advisor noise and improve hot-path policy/index performance.
-- These changes are intentionally narrow:
-- - add leading-column indexes for foreign keys flagged by Supabase Advisor,
-- - remove a duplicate orders(customer_id) index while keeping idx_orders_customer_id,
-- - preserve existing RLS semantics while wrapping auth.uid() in SELECT so it is
--   evaluated once per statement instead of once per row,
-- - add explicit service_role policies for internal RLS-enabled tables that have
--   no user-facing policies,
-- - pin search_path on advisor-flagged functions without changing behavior.

-- 1. Foreign key covering indexes. Existing composite indexes on several of
-- these tables start with merchant_id, so they do not cover FK checks where the
-- FK column is not the leading column.
CREATE INDEX IF NOT EXISTS idx_customer_savings_contributions_customer_id_fk
  ON public.customer_savings_contributions (customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_savings_events_customer_id_fk
  ON public.customer_savings_events (customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_savings_goals_customer_id_fk
  ON public.customer_savings_goals (customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_savings_goals_product_id_fk
  ON public.customer_savings_goals (product_id);

CREATE INDEX IF NOT EXISTS idx_customer_savings_redemptions_customer_id_fk
  ON public.customer_savings_redemptions (customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_payment_accounts_customer_id_fk
  ON public.customer_wallet_payment_accounts (customer_id);

CREATE INDEX IF NOT EXISTS idx_expenses_branch_id_fk
  ON public.expenses (branch_id);

CREATE INDEX IF NOT EXISTS idx_order_wallet_funding_events_order_id_fk
  ON public.order_wallet_funding_events (order_id);

CREATE INDEX IF NOT EXISTS idx_order_wallet_funding_events_transaction_id_fk
  ON public.order_wallet_funding_events (transaction_id);

CREATE INDEX IF NOT EXISTS idx_orders_branch_id_fk
  ON public.orders (branch_id);

CREATE INDEX IF NOT EXISTS idx_variant_inventory_branch_id_fk
  ON public.variant_inventory (branch_id);

CREATE INDEX IF NOT EXISTS idx_vtu_idempotency_keys_merchant_id_fk
  ON public.vtu_idempotency_keys (merchant_id);

-- Keep the newer index name from 20260504000000_optimise_order_items_rls_exists.sql.
DROP INDEX IF EXISTS public.orders_customer_id_idx;

-- 2. RLS auth initplan fixes. Each recreated policy preserves the old access
-- predicate and only changes auth.uid() to (SELECT auth.uid()).
DROP POLICY IF EXISTS "Platform admins can delete platform blog posts" ON public.blog_posts;
CREATE POLICY "Platform admins can delete platform blog posts"
  ON public.blog_posts
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    is_platform_post IS TRUE
    AND merchant_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
        AND merchants.is_platform_admin IS TRUE
    )
  );

DROP POLICY IF EXISTS "Platform admins can insert platform blog posts" ON public.blog_posts;
CREATE POLICY "Platform admins can insert platform blog posts"
  ON public.blog_posts
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_platform_post IS TRUE
    AND merchant_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
        AND merchants.is_platform_admin IS TRUE
    )
  );

DROP POLICY IF EXISTS "Platform admins can update platform blog posts" ON public.blog_posts;
CREATE POLICY "Platform admins can update platform blog posts"
  ON public.blog_posts
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    is_platform_post IS TRUE
    AND merchant_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
        AND merchants.is_platform_admin IS TRUE
    )
  )
  WITH CHECK (
    is_platform_post IS TRUE
    AND merchant_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
        AND merchants.is_platform_admin IS TRUE
    )
  );

DROP POLICY IF EXISTS "Platform blog posts require published status or admin read" ON public.blog_posts;
CREATE POLICY "Platform blog posts require published status or admin read"
  ON public.blog_posts
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (
    is_platform_post IS NOT TRUE
    OR (
      is_platform_post IS TRUE
      AND merchant_id IS NULL
      AND (
        (status = 'published'::text AND published_at IS NOT NULL)
        OR EXISTS (
          SELECT 1
          FROM public.merchants
          WHERE merchants.user_id = (SELECT auth.uid())
            AND merchants.is_platform_admin IS TRUE
        )
      )
    )
  );

DROP POLICY IF EXISTS customer_wallet_payment_accounts_customer_select ON public.customer_wallet_payment_accounts;
CREATE POLICY customer_wallet_payment_accounts_customer_select
  ON public.customer_wallet_payment_accounts
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_wallet_payment_accounts.customer_id
        AND c.user_id = (SELECT auth.uid())
        AND c.merchant_id = customer_wallet_payment_accounts.merchant_id
    )
  );

DROP POLICY IF EXISTS customer_savings_goals_customer_select ON public.customer_savings_goals;
CREATE POLICY customer_savings_goals_customer_select
  ON public.customer_savings_goals
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_savings_goals.customer_id
        AND c.user_id = (SELECT auth.uid())
        AND c.merchant_id = customer_savings_goals.merchant_id
    )
  );

DROP POLICY IF EXISTS customer_savings_contributions_customer_select ON public.customer_savings_contributions;
CREATE POLICY customer_savings_contributions_customer_select
  ON public.customer_savings_contributions
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_savings_contributions.customer_id
        AND c.user_id = (SELECT auth.uid())
        AND c.merchant_id = customer_savings_contributions.merchant_id
    )
  );

DROP POLICY IF EXISTS customer_savings_redemptions_customer_select ON public.customer_savings_redemptions;
CREATE POLICY customer_savings_redemptions_customer_select
  ON public.customer_savings_redemptions
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_savings_redemptions.customer_id
        AND c.user_id = (SELECT auth.uid())
        AND c.merchant_id = customer_savings_redemptions.merchant_id
    )
  );

DROP POLICY IF EXISTS customer_savings_events_customer_select ON public.customer_savings_events;
CREATE POLICY customer_savings_events_customer_select
  ON public.customer_savings_events
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_savings_events.customer_id
        AND c.user_id = (SELECT auth.uid())
        AND c.merchant_id = customer_savings_events.merchant_id
    )
  );

DROP POLICY IF EXISTS order_wallet_funding_intents_customer_select ON public.order_wallet_funding_intents;
CREATE POLICY order_wallet_funding_intents_customer_select
  ON public.order_wallet_funding_intents
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = order_wallet_funding_intents.customer_id
        AND c.user_id = (SELECT auth.uid())
        AND c.merchant_id = order_wallet_funding_intents.merchant_id
    )
  );

DROP POLICY IF EXISTS order_wallet_funding_intent_payments_customer_select ON public.order_wallet_funding_intent_payments;
CREATE POLICY order_wallet_funding_intent_payments_customer_select
  ON public.order_wallet_funding_intent_payments
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_wallet_funding_intents i
      JOIN public.customers c
        ON c.id = i.customer_id
       AND c.merchant_id = i.merchant_id
      WHERE i.id = order_wallet_funding_intent_payments.intent_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

-- 3. RLS-enabled internal tables with no user-facing policies. Access remains
-- service-role only; anon/authenticated still have no grants/policies.
DROP POLICY IF EXISTS order_wallet_funding_events_service_role_all ON public.order_wallet_funding_events;
CREATE POLICY order_wallet_funding_events_service_role_all
  ON public.order_wallet_funding_events
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS quiz_compliance_tracker_service_role_all ON public.quiz_compliance_tracker;
CREATE POLICY quiz_compliance_tracker_service_role_all
  ON public.quiz_compliance_tracker
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS quiz_proof_validation_failures_service_role_all ON public.quiz_proof_validation_failures;
CREATE POLICY quiz_proof_validation_failures_service_role_all
  ON public.quiz_proof_validation_failures
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS vtu_idempotency_keys_service_role_all ON public.vtu_idempotency_keys;
CREATE POLICY vtu_idempotency_keys_service_role_all
  ON public.vtu_idempotency_keys
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Public buckets do not require a broad storage.objects SELECT policy for
-- public object URL delivery. Removing it prevents public listing via Storage API.
DROP POLICY IF EXISTS "Public can view media files" ON storage.objects;

-- 5. Function search_path hardening. Logic is unchanged.
CREATE OR REPLACE FUNCTION public.enforce_blog_post_products_merchant_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.blog_posts
    WHERE id = NEW.blog_post_id
      AND merchant_id = NEW.merchant_id
  ) THEN
    RAISE EXCEPTION
      'blog_post_id % is not owned by merchant %',
      NEW.blog_post_id,
      NEW.merchant_id
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products
    WHERE id = NEW.product_id
      AND merchant_id = NEW.merchant_id
  ) THEN
    RAISE EXCEPTION
      'product_id % is not owned by merchant %',
      NEW.product_id,
      NEW.merchant_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.touch_agentic_idempotency_records_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.current_agentic_merchant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN (auth.jwt() ->> 'agentic_merchant_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (auth.jwt() ->> 'agentic_merchant_id')::uuid
    ELSE NULL
  END
$function$;

CREATE OR REPLACE FUNCTION public.is_agentic_checkout_context()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  SELECT COALESCE((auth.jwt() ->> 'agentic_context') = 'checkout', FALSE)
$function$;
