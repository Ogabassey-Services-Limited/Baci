-- Staff Access RLS for order_payment_accounts
-- Allows staff members to SELECT and INSERT payment accounts for their merchant's orders.
-- The existing policies only check merchants.user_id = auth.uid(), which excludes staff.

-- Drop existing owner-only policies
DROP POLICY IF EXISTS "Merchants can view their order payment accounts" ON order_payment_accounts;
DROP POLICY IF EXISTS "Merchants can insert order payment accounts" ON order_payment_accounts;

-- SELECT: Owners + active staff
CREATE POLICY "owners_and_staff_select_order_payment_accounts" ON order_payment_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payment_accounts.order_id
      AND o.merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
        UNION ALL
        SELECT merchant_id FROM staff_members WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- INSERT: Owners + active staff
CREATE POLICY "owners_and_staff_insert_order_payment_accounts" ON order_payment_accounts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payment_accounts.order_id
      AND o.merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
        UNION ALL
        SELECT merchant_id FROM staff_members WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );
