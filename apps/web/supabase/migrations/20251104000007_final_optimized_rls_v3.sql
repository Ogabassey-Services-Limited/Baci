-- This is the final, consolidated, and optimized RLS policy migration (v3).
-- It resolves all known performance and security linter warnings with corrected syntax.

-- First, drop all previous attempts to be clean.
DROP POLICY IF EXISTS "Allow users to create their own customer record" ON public.customers;
DROP POLICY IF EXISTS "Allow users to view their own customer record" ON public.customers;
DROP POLICY IF EXISTS "Allow users to update their own customer record" ON public.customers;
DROP POLICY IF EXISTS "Allow merchants to view their customers" ON public.customers;
DROP POLICY IF EXISTS "Enable SELECT for users and merchants on customers" ON public.customers;
DROP POLICY IF EXISTS "Enable INSERT for users on their own customer record" ON public.customers;
DROP POLICY IF EXISTS "Enable UPDATE for users on their own customer record" ON public.customers;

DROP POLICY IF EXISTS "Allow users to create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow users to view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow merchants to manage their orders" ON public.orders;
DROP POLICY IF EXISTS "Enable SELECT for users and merchants on orders" ON public.orders;
DROP POLICY IF EXISTS "Enable INSERT for users and merchants on orders" ON public.orders;
DROP POLICY IF EXISTS "Enable UPDATE and DELETE for merchants on orders" ON public.orders;


-- ========== CUSTOMERS TABLE POLICIES ==========

-- A user can see a customer record if they are that customer OR they are the associated merchant.
CREATE POLICY "Enable SELECT for users and merchants on customers" 
ON public.customers FOR SELECT
USING (
  (user_id = (SELECT auth.uid())) OR
  (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())))
);

-- A user can only create a customer record for themselves.
CREATE POLICY "Enable INSERT for users on their own customer record" 
ON public.customers FOR INSERT
WITH CHECK ( user_id = (SELECT auth.uid()) );

-- A user can only update their own customer record.
CREATE POLICY "Enable UPDATE for users on their own customer record" 
ON public.customers FOR UPDATE
USING ( user_id = (SELECT auth.uid()) );

-- ========== ORDERS TABLE POLICIES ==========

-- A user can see an order if they are the customer OR they are the merchant.
CREATE POLICY "Enable SELECT for users and merchants on orders"
ON public.orders FOR SELECT
USING (
  (customer_id IN (SELECT id FROM public.customers WHERE user_id = (SELECT auth.uid()))) OR
  (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())))
);

-- An order can be created by the customer themselves, or by the relevant merchant.
CREATE POLICY "Enable INSERT for users and merchants on orders"
ON public.orders FOR INSERT
WITH CHECK (
  (customer_id IN (SELECT id FROM public.customers WHERE user_id = (SELECT auth.uid()))) OR
  (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())))
);

-- Only the merchant associated with an order can UPDATE it.
CREATE POLICY "Enable UPDATE for merchants on orders"
ON public.orders FOR UPDATE
USING ( merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())) );

-- Only the merchant associated with an order can DELETE it.
CREATE POLICY "Enable DELETE for merchants on orders"
ON public.orders FOR DELETE
USING ( merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())) );
