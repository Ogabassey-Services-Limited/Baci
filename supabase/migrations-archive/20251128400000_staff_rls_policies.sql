-- Migration: Staff RLS Policies
-- Created: 2025-11-28
-- Description: Update RLS policies to allow staff members access based on their permissions

-- =============================================================================
-- Helper function to check if user has access to a merchant (owner OR active staff)
-- =============================================================================

CREATE OR REPLACE FUNCTION has_merchant_access(p_merchant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM merchants WHERE id = p_merchant_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM staff_members
    WHERE merchant_id = p_merchant_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Update products table RLS
-- =============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Staff can view products" ON products;
DROP POLICY IF EXISTS "Staff can insert products" ON products;
DROP POLICY IF EXISTS "Staff can update products" ON products;
DROP POLICY IF EXISTS "Staff can delete products" ON products;

-- Staff can view products for their merchant
CREATE POLICY "Staff can view products" ON products
  FOR SELECT USING (
    has_merchant_access(merchant_id)
    OR is_available = true -- Public products are always visible
  );

-- Staff can insert products if they have permission
CREATE POLICY "Staff can insert products" ON products
  FOR INSERT WITH CHECK (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'products', 'create')
  );

-- Staff can update products if they have permission
CREATE POLICY "Staff can update products" ON products
  FOR UPDATE USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'products', 'edit')
  );

-- Staff can delete products if they have permission
CREATE POLICY "Staff can delete products" ON products
  FOR DELETE USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'products', 'delete')
  );

-- =============================================================================
-- Update orders table RLS
-- =============================================================================

DROP POLICY IF EXISTS "Staff can view orders" ON orders;
DROP POLICY IF EXISTS "Staff can insert orders" ON orders;
DROP POLICY IF EXISTS "Staff can update orders" ON orders;

-- Staff can view orders for their merchant
CREATE POLICY "Staff can view orders" ON orders
  FOR SELECT USING (
    has_merchant_access(merchant_id)
    OR customer_id = auth.uid() -- Customers can see their own orders
  );

-- Staff can create orders if they have permission
CREATE POLICY "Staff can insert orders" ON orders
  FOR INSERT WITH CHECK (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'orders', 'create')
    OR customer_id = auth.uid() -- Customers can create their own orders
  );

-- Staff can update orders if they have permission
CREATE POLICY "Staff can update orders" ON orders
  FOR UPDATE USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'orders', 'edit')
  );

-- =============================================================================
-- Update order_items table RLS
-- =============================================================================

DROP POLICY IF EXISTS "Staff can view order items" ON order_items;
DROP POLICY IF EXISTS "Staff can insert order items" ON order_items;

-- Staff can view order items through orders they can access
CREATE POLICY "Staff can view order items" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE has_merchant_access(merchant_id)
    )
    OR order_id IN (
      SELECT id FROM orders WHERE customer_id = auth.uid()
    )
  );

-- Staff can insert order items if they have order create permission
CREATE POLICY "Staff can insert order items" ON order_items
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT id FROM orders
      WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
        OR check_staff_permission(auth.uid(), merchant_id, 'orders', 'create')
        OR customer_id = auth.uid()
    )
  );

-- =============================================================================
-- Update customers table RLS (if exists)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    DROP POLICY IF EXISTS "Staff can view customers" ON customers;
    DROP POLICY IF EXISTS "Staff can insert customers" ON customers;
    DROP POLICY IF EXISTS "Staff can update customers" ON customers;

    CREATE POLICY "Staff can view customers" ON customers
      FOR SELECT USING (
        has_merchant_access(merchant_id)
        OR user_id = auth.uid() -- Users can see their own customer record
      );

    CREATE POLICY "Staff can insert customers" ON customers
      FOR INSERT WITH CHECK (
        merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
        OR check_staff_permission(auth.uid(), merchant_id, 'customers', 'create')
      );

    CREATE POLICY "Staff can update customers" ON customers
      FOR UPDATE USING (
        merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
        OR check_staff_permission(auth.uid(), merchant_id, 'customers', 'edit')
      );
  END IF;
END $$;

-- =============================================================================
-- Update daily_sales_summary table RLS (analytics)
-- =============================================================================

DROP POLICY IF EXISTS "Staff can view analytics" ON daily_sales_summary;

-- Staff can view analytics if they have analytics.view permission
CREATE POLICY "Staff can view analytics" ON daily_sales_summary
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'analytics', 'view')
  );

-- =============================================================================
-- Update wishlists table RLS
-- =============================================================================

DROP POLICY IF EXISTS "Staff can view wishlists" ON wishlists;

-- Staff can view wishlists for their merchant
CREATE POLICY "Staff can view wishlists" ON wishlists
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'customers', 'view')
    OR user_id = auth.uid() -- Users can see their own wishlists
  );

-- =============================================================================
-- Update wishlist_items table RLS
-- =============================================================================

DROP POLICY IF EXISTS "Staff can view wishlist items" ON wishlist_items;

-- Staff can view wishlist items through wishlists they can access
CREATE POLICY "Staff can view wishlist items" ON wishlist_items
  FOR SELECT USING (
    wishlist_id IN (
      SELECT id FROM wishlists
      WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
        OR check_staff_permission(auth.uid(), merchant_id, 'customers', 'view')
        OR user_id = auth.uid()
    )
  );

-- =============================================================================
-- Grant staff view access to merchant info (limited)
-- =============================================================================

DROP POLICY IF EXISTS "Staff can view merchant" ON merchants;

-- Staff can view merchant info for stores they work at
CREATE POLICY "Staff can view merchant" ON merchants
  FOR SELECT USING (
    user_id = auth.uid() -- Owner
    OR id IN (SELECT merchant_id FROM staff_members WHERE user_id = auth.uid() AND status = 'active')
    OR is_platform_admin = false -- Public merchant info for storefronts
  );

-- =============================================================================
-- Update role_permissions table RLS (allow all to read)
-- =============================================================================

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view role permissions" ON role_permissions;

CREATE POLICY "Anyone can view role permissions" ON role_permissions
  FOR SELECT USING (true);

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON FUNCTION has_merchant_access IS 'Check if user is owner or active staff of a merchant';
