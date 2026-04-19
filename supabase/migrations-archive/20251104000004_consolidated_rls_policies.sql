-- This file creates a single, consolidated set of RLS policies for the application.

-- ========== CUSTOMERS TABLE POLICIES ==========

-- 1. Allow users to create their own customer record
CREATE POLICY "Allow users to create their own customer record"
ON public.customers FOR INSERT
WITH CHECK ( user_id = auth.uid() );

-- 2. Allow users to view their own customer record
CREATE POLICY "Allow users to view their own customer record"
ON public.customers FOR SELECT
USING ( user_id = auth.uid() );

-- 3. Allow users to update their own customer record
CREATE POLICY "Allow users to update their own customer record"
ON public.customers FOR UPDATE
USING ( user_id = auth.uid() );

-- 4. Allow merchants to view the customer records they are associated with
CREATE POLICY "Allow merchants to view their customers"
ON public.customers FOR SELECT
USING ( merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()) );


-- ========== ORDERS TABLE POLICIES ==========

-- 1. Allow users to create orders for themselves
CREATE POLICY "Allow users to create their own orders"
ON public.orders FOR INSERT
WITH CHECK ( customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) );

-- 2. Allow users to view their own orders
CREATE POLICY "Allow users to view their own orders"
ON public.orders FOR SELECT
USING ( customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) );

-- 3. Allow merchants to manage orders for their own customers
CREATE POLICY "Allow merchants to manage their orders"
ON public.orders FOR ALL
USING ( merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()) )
WITH CHECK ( merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()) AND (customer_id IS NULL OR customer_id IN (SELECT id FROM customers WHERE merchant_id = orders.merchant_id)) );
