-- This file contains fixes for critical RLS vulnerabilities and bugs.

-- ========== CUSTOMERS POLICIES ==========

-- Drop the insecure customer registration policy
DROP POLICY IF EXISTS "Allow customer registration" ON public.customers;

-- Allow authenticated users to create their own customer record.
-- This prevents a user from creating a customer record for another user.
CREATE POLICY "Allow authenticated users to create their own customer record"
ON public.customers
FOR INSERT
WITH CHECK (user_id = auth.uid());


-- ========== ORDERS POLICIES ==========

-- The migration 20251103000000_feature_infinity_stock.sql dropped the policy
-- that allowed customers to create orders, which broke the checkout flow.
-- This policy restores that functionality, but in a secure way.

-- Allow authenticated users to create orders for themselves.
-- This ensures a user can only create an order linked to their own customer record.
CREATE POLICY "Allow authenticated users to create orders for themselves"
ON public.orders
FOR INSERT
WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));


-- The existing policy for merchants allows them to create an order for any customer,
-- even those belonging to other merchants. This policy fixes that.

-- Drop the existing policy and create a more secure one
DROP POLICY IF EXISTS "Merchants can manage their own orders" ON public.orders;

-- Merchants can manage orders for their own customers
CREATE POLICY "Merchants can manage their own orders"
  ON public.orders
  FOR ALL
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()))
  WITH CHECK (
    -- The merchant must be the one creating the order
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()) AND
    -- The customer must belong to the merchant
    (customer_id IS NULL OR customer_id IN (SELECT id FROM customers WHERE merchant_id = orders.merchant_id))
  );
