-- This file contains fixes for the RLS performance issues identified by the Supabase linter.

-- ========== CUSTOMERS POLICIES ==========

-- Consolidate and optimize customer policies
DROP POLICY IF EXISTS "Allow any user to create a customer entry" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users to create their own customer record" ON public.customers;

CREATE POLICY "Allow authenticated users to manage their own customer record"
ON public.customers
FOR ALL
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));


-- ========== ORDERS POLICIES ==========

-- Optimize existing policies for performance
ALTER POLICY "Customers can view their own orders" ON public.orders
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = (SELECT auth.uid())));

ALTER POLICY "Allow authenticated users to create orders for themselves" ON public.orders
  WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE user_id = (SELECT auth.uid())));

ALTER POLICY "Merchants can manage their own orders" ON public.orders
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())) AND
    (customer_id IS NULL OR customer_id IN (SELECT id FROM customers WHERE merchant_id = orders.merchant_id))
  );

-- ========== ORDER_ITEMS POLICIES ==========

-- Optimize existing policies for performance
ALTER POLICY "Merchants can insert order items for their orders" ON public.order_items
  WITH CHECK (order_id IN (SELECT id FROM orders WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid()))));

ALTER POLICY "Merchants can update order items for their orders" ON public.order_items
  USING (order_id IN (SELECT id FROM orders WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid()))));
