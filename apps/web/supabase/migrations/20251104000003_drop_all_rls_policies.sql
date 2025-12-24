-- This file drops all existing RLS policies on the customers and orders tables

-- ========== DROP CUSTOMER POLICIES ==========
DROP POLICY IF EXISTS "Allow any user to create a customer entry" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users to create their own customer record" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users to manage their own customer record" ON public.customers;
DROP POLICY IF EXISTS "Allow users to view relevant customer data" ON public.customers;
DROP POLICY IF EXISTS "Allow customers to update their own data" ON public.customers;
DROP POLICY IF EXISTS "Customers can view own data" ON public.customers;
DROP POLICY IF EXISTS "Customers can update own data" ON public.customers;
DROP POLICY IF EXISTS "Merchants can view own customers" ON public.customers;
DROP POLICY IF EXISTS "Allow customer registration" ON public.customers;


-- ========== DROP ORDER POLICIES ==========
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated users to create orders for themselves" ON public.orders;
DROP POLICY IF EXISTS "Merchants can manage their own orders" ON public.orders;
