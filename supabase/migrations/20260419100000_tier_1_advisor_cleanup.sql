-- Tier 1 Supabase advisor cleanup
--
-- Addresses the clean-win findings from `mcp__supabase__get_advisors`:
--   * 2× function_search_path_mutable  (WARN, security)
--   * 14× auth_rls_initplan            (WARN, performance)
--   * 1×  unindexed_foreign_keys       (INFO, performance)
--   * 3×  rls_enabled_no_policy        (INFO, security)
--
-- Each change is behaviour-preserving:
--   * ALTER FUNCTION ... SET search_path just pins the lookup path.
--   * (SELECT auth.uid()) makes the call an InitPlan evaluated once per
--     query instead of per row. Semantics identical.
--   * The new FK index is pure add.
--   * The `deny_public_access` policies are explicit forms of the existing
--     default-deny behaviour when RLS is enabled with no policies — they
--     don't change who can actually read/write (service role still
--     bypasses RLS, SECURITY DEFINER functions still bypass).

-- ========================================================================
-- 1. function_search_path_mutable  (2 functions)
-- ========================================================================
ALTER FUNCTION public.extract_primary_image_from_jsonb(jsonb)  SET search_path TO 'public';
ALTER FUNCTION public.format_order_item_variant_name(jsonb)    SET search_path TO 'public';

-- ========================================================================
-- 2. unindexed_foreign_keys  (1 missing index)
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_pending_import_uploads_created_by
  ON public.pending_import_uploads(created_by);

-- ========================================================================
-- 3. auth_rls_initplan  —  wrap auth.uid() in (SELECT auth.uid())
-- ========================================================================

-- customer_saved_payment_methods (4)
DROP POLICY IF EXISTS "Customers can view their own saved payment methods"
  ON public.customer_saved_payment_methods;
CREATE POLICY "Customers can view their own saved payment methods"
  ON public.customer_saved_payment_methods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = customer_saved_payment_methods.customer_id
        AND customers.user_id = (SELECT auth.uid())
    )
    OR merchant_id IN (
      SELECT merchants.id FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Customers can insert their own saved payment methods"
  ON public.customer_saved_payment_methods;
CREATE POLICY "Customers can insert their own saved payment methods"
  ON public.customer_saved_payment_methods FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = customer_saved_payment_methods.customer_id
        AND customers.user_id = (SELECT auth.uid())
    )
    OR merchant_id IN (
      SELECT merchants.id FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Customers can update their own saved payment methods"
  ON public.customer_saved_payment_methods;
CREATE POLICY "Customers can update their own saved payment methods"
  ON public.customer_saved_payment_methods FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = customer_saved_payment_methods.customer_id
        AND customers.user_id = (SELECT auth.uid())
    )
    OR merchant_id IN (
      SELECT merchants.id FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Customers can delete their own saved payment methods"
  ON public.customer_saved_payment_methods;
CREATE POLICY "Customers can delete their own saved payment methods"
  ON public.customer_saved_payment_methods FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = customer_saved_payment_methods.customer_id
        AND customers.user_id = (SELECT auth.uid())
    )
    OR merchant_id IN (
      SELECT merchants.id FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
    )
  );

-- pending_import_uploads (3)
DROP POLICY IF EXISTS "Merchants can view pending import uploads"
  ON public.pending_import_uploads;
CREATE POLICY "Merchants can view pending import uploads"
  ON public.pending_import_uploads FOR SELECT
  USING (
    merchant_id IN (
      SELECT merchants.id FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission((SELECT auth.uid()), merchant_id, 'settings', 'edit')
    OR public.check_staff_permission((SELECT auth.uid()), merchant_id, 'orders',   'edit')
    OR public.check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'create')
  );

DROP POLICY IF EXISTS "Merchants can create pending import uploads"
  ON public.pending_import_uploads;
CREATE POLICY "Merchants can create pending import uploads"
  ON public.pending_import_uploads FOR INSERT
  WITH CHECK (
    merchant_id IN (
      SELECT merchants.id FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission((SELECT auth.uid()), merchant_id, 'settings', 'edit')
    OR public.check_staff_permission((SELECT auth.uid()), merchant_id, 'orders',   'edit')
    OR public.check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'create')
  );

DROP POLICY IF EXISTS "Merchants can update pending import uploads"
  ON public.pending_import_uploads;
CREATE POLICY "Merchants can update pending import uploads"
  ON public.pending_import_uploads FOR UPDATE
  USING (
    merchant_id IN (
      SELECT merchants.id FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission((SELECT auth.uid()), merchant_id, 'settings', 'edit')
    OR public.check_staff_permission((SELECT auth.uid()), merchant_id, 'orders',   'edit')
    OR public.check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'create')
  )
  WITH CHECK (
    merchant_id IN (
      SELECT merchants.id FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission((SELECT auth.uid()), merchant_id, 'settings', 'edit')
    OR public.check_staff_permission((SELECT auth.uid()), merchant_id, 'orders',   'edit')
    OR public.check_staff_permission((SELECT auth.uid()), merchant_id, 'products', 'create')
  );

-- product_offer_migration_archive (1)
DROP POLICY IF EXISTS "Merchants can view archived product offers"
  ON public.product_offer_migration_archive;
CREATE POLICY "Merchants can view archived product offers"
  ON public.product_offer_migration_archive FOR SELECT TO authenticated
  USING (
    merchant_id = (SELECT auth.uid())
    OR merchant_id IN (
      SELECT merchants.id FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
    )
  );

-- product_variant_migration_archive (1)
DROP POLICY IF EXISTS "Merchants can view archived product variants"
  ON public.product_variant_migration_archive;
CREATE POLICY "Merchants can view archived product variants"
  ON public.product_variant_migration_archive FOR SELECT TO authenticated
  USING (
    merchant_id = (SELECT auth.uid())
    OR merchant_id IN (
      SELECT merchants.id FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
    )
  );

-- push_notification_attempts (1)
DROP POLICY IF EXISTS platform_admins_read_push_notification_attempts
  ON public.push_notification_attempts;
CREATE POLICY platform_admins_read_push_notification_attempts
  ON public.push_notification_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
        AND merchants.is_platform_admin = true
    )
  );

-- push_notification_tickets (1)
DROP POLICY IF EXISTS platform_admins_read_push_notification_tickets
  ON public.push_notification_tickets;
CREATE POLICY platform_admins_read_push_notification_tickets
  ON public.push_notification_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
        AND merchants.is_platform_admin = true
    )
  );

-- push_registration_diagnostics (2)
DROP POLICY IF EXISTS admins_can_read_diagnostics
  ON public.push_registration_diagnostics;
CREATE POLICY admins_can_read_diagnostics
  ON public.push_registration_diagnostics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.merchants
      WHERE merchants.user_id = (SELECT auth.uid())
        AND merchants.is_platform_admin = true
    )
  );

DROP POLICY IF EXISTS "Push registration diagnostics insert policy"
  ON public.push_registration_diagnostics;
CREATE POLICY "Push registration diagnostics insert policy"
  ON public.push_registration_diagnostics FOR INSERT
  WITH CHECK (
    (app_type = 'admin'
      AND (SELECT auth.uid()) IS NOT NULL
      AND (user_id IS NULL OR ((SELECT auth.uid())::text = user_id))
    )
    OR (app_type = 'storefront'
      AND merchant_id IS NOT NULL
      AND (user_id IS NULL OR ((SELECT auth.uid())::text = user_id))
    )
  );

-- push_tokens (3)
DROP POLICY IF EXISTS "Users can insert own push tokens"
  ON public.push_tokens;
CREATE POLICY "Users can insert own push tokens"
  ON public.push_tokens FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR (user_id IS NULL AND merchant_id IS NOT NULL AND app_type = 'storefront')
  );

DROP POLICY IF EXISTS "Users can update own push tokens"
  ON public.push_tokens;
CREATE POLICY "Users can update own push tokens"
  ON public.push_tokens FOR UPDATE
  USING (
    (SELECT auth.uid()) = user_id
    OR user_id IS NULL
    OR is_active = false
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR user_id IS NULL
  );

DROP POLICY IF EXISTS "Users can delete own push tokens"
  ON public.push_tokens;
CREATE POLICY "Users can delete own push tokens"
  ON public.push_tokens FOR DELETE
  USING (
    (SELECT auth.uid()) = user_id
    OR (user_id IS NULL AND app_type = 'storefront')
  );

-- ========================================================================
-- 4. rls_enabled_no_policy  —  explicit deny-all to silence the linter.
--
--    These tables were already effectively deny-only to client roles
--    (anon, authenticated). Access still flows via SECURITY DEFINER
--    functions / service role / the Management API. The explicit policies
--    make the intent visible to the linter (and to future reviewers).
-- ========================================================================
DROP POLICY IF EXISTS deny_public_access ON public.email_send_attempts;
CREATE POLICY deny_public_access ON public.email_send_attempts
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_public_access ON public.merchant_verifications;
CREATE POLICY deny_public_access ON public.merchant_verifications
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_public_access ON public.oauth_handoff_tickets;
CREATE POLICY deny_public_access ON public.oauth_handoff_tickets
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
