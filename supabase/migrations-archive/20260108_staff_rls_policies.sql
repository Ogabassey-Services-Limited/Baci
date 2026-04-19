-- Staff Access RLS Policies Migration
-- Run this migration to allow staff members to access their merchant's data

-- ============================================================================
-- ORDERS: Allow staff to access their merchant's orders
-- ============================================================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "staff_orders_select" ON orders;
DROP POLICY IF EXISTS "staff_orders_update" ON orders;

-- Staff can view orders for their merchant
CREATE POLICY "staff_orders_select" ON orders
  FOR SELECT USING (
    merchant_id IN (
      SELECT merchant_id FROM staff_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- Staff can update orders for their merchant
CREATE POLICY "staff_orders_update" ON orders
  FOR UPDATE USING (
    merchant_id IN (
      SELECT merchant_id FROM staff_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- PRODUCTS: Allow staff to access their merchant's products
-- ============================================================================

DROP POLICY IF EXISTS "staff_products_select" ON products;
DROP POLICY IF EXISTS "staff_products_update" ON products;

CREATE POLICY "staff_products_select" ON products
  FOR SELECT USING (
    merchant_id IN (
      SELECT merchant_id FROM staff_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "staff_products_update" ON products
  FOR UPDATE USING (
    merchant_id IN (
      SELECT merchant_id FROM staff_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRANSACTIONS: Allow staff to view their merchant's transactions
-- ============================================================================

DROP POLICY IF EXISTS "staff_transactions_select" ON transactions;

CREATE POLICY "staff_transactions_select" ON transactions
  FOR SELECT USING (
    merchant_id IN (
      SELECT merchant_id FROM staff_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- CUSTOMERS: Allow staff to access their merchant's customers
-- ============================================================================

DROP POLICY IF EXISTS "staff_customers_select" ON customers;

CREATE POLICY "staff_customers_select" ON customers
  FOR SELECT USING (
    merchant_id IN (
      SELECT merchant_id FROM staff_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Note: Run this migration in Supabase Dashboard > SQL Editor
-- Or via: supabase db push (if using local development)
-- ============================================================================
