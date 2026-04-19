
-- Fix remaining 16 Performance Advisor WARN:
-- 5 auth_rls_initplan + 11 multiple_permissive_policies

BEGIN;

-- ============================================================
-- 1. auth_rls_initplan: order_reminders (2 policies)
--    Wrap bare auth.uid() → (SELECT auth.uid())
-- ============================================================

DROP POLICY IF EXISTS "Merchants can view their order reminders" ON order_reminders;
CREATE POLICY "Merchants can view their order reminders" ON order_reminders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN merchants m ON o.merchant_id = m.id
      WHERE o.id = order_reminders.order_id
      AND m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Merchants can insert order reminders" ON order_reminders;
CREATE POLICY "Merchants can insert order reminders" ON order_reminders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN merchants m ON o.merchant_id = m.id
      WHERE o.id = order_reminders.order_id
      AND m.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 2. auth_rls_initplan: order_payment_accounts (2 policies)
--    Wrap bare auth.uid() → (SELECT auth.uid())
-- ============================================================

DROP POLICY IF EXISTS "owners_and_staff_select_order_payment_accounts" ON order_payment_accounts;
CREATE POLICY "owners_and_staff_select_order_payment_accounts" ON order_payment_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payment_accounts.order_id
      AND o.merchant_id IN (
        SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())
        UNION ALL
        SELECT staff_members.merchant_id FROM staff_members
        WHERE staff_members.user_id = (SELECT auth.uid()) AND staff_members.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "owners_and_staff_insert_order_payment_accounts" ON order_payment_accounts;
CREATE POLICY "owners_and_staff_insert_order_payment_accounts" ON order_payment_accounts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payment_accounts.order_id
      AND o.merchant_id IN (
        SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())
        UNION ALL
        SELECT staff_members.merchant_id FROM staff_members
        WHERE staff_members.user_id = (SELECT auth.uid()) AND staff_members.status = 'active'
      )
    )
  );

-- ============================================================
-- 3. auth_rls_initplan: return_requests (1 policy)
--    Wrap bare auth.uid() → (SELECT auth.uid())
-- ============================================================

DROP POLICY IF EXISTS "Merchants manage own return requests" ON return_requests;
CREATE POLICY "Merchants manage own return requests" ON return_requests
  FOR ALL USING (
    merchant_id IN (
      SELECT merchants.id FROM merchants WHERE merchants.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- 4. multiple_permissive_policies: merchants (2 SELECT → 1)
--    "Consolidated view permissions" + "Public can view merchants"
--    Merged: non-admin merchants visible to all, plus own merchants
-- ============================================================

DROP POLICY IF EXISTS "Consolidated view permissions" ON merchants;
DROP POLICY IF EXISTS "Public can view merchants" ON merchants;
CREATE POLICY "Consolidated view permissions" ON merchants
  FOR SELECT USING (
    (is_platform_admin IS NOT TRUE)
    OR (id IN (
      SELECT get_user_merchant_access.merchant_id
      FROM get_user_merchant_access((SELECT auth.uid()))
    ))
  );

-- ============================================================
-- 5. multiple_permissive_policies: shipments (2 SELECT → 1)
--    "Staff can view shipments" + "Users can view relevant shipments"
--    Merged: merchant access OR customer who placed the order
-- ============================================================

DROP POLICY IF EXISTS "Staff can view shipments" ON shipments;
DROP POLICY IF EXISTS "Users can view relevant shipments" ON shipments;
CREATE POLICY "Users can view relevant shipments" ON shipments
  FOR SELECT USING (
    has_merchant_access(merchant_id)
    OR (order_id IN (
      SELECT orders.id FROM orders
      WHERE orders.customer_id IN (
        SELECT customers.id FROM customers
        WHERE customers.user_id = (SELECT auth.uid())
      )
    ))
  );

-- ============================================================
-- 6. multiple_permissive_policies: loyalty_airtime_rewards (2 SELECT → 1)
--    "Public can view active airtime rewards" (anon) +
--    "Staff can view loyalty airtime rewards" (public)
--    Merged: active rewards visible to all, plus merchant access
-- ============================================================

DROP POLICY IF EXISTS "Public can view active airtime rewards" ON loyalty_airtime_rewards;
DROP POLICY IF EXISTS "Staff can view loyalty airtime rewards" ON loyalty_airtime_rewards;
CREATE POLICY "View loyalty airtime rewards" ON loyalty_airtime_rewards
  FOR SELECT USING (
    (is_active = true) OR has_merchant_access(merchant_id)
  );

COMMIT;
;
