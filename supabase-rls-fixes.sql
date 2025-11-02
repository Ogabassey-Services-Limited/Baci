DROP POLICY IF EXISTS "Merchants can view own data" ON public.merchants;
DROP POLICY IF EXISTS "Merchants can update own data" ON public.merchants;
DROP POLICY IF EXISTS "Merchants can insert own data" ON public.merchants;
CREATE POLICY "Merchants can view own data"
  ON public.merchants
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Merchants can update own data"
  ON public.merchants
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Merchants can insert own data"
  ON public.merchants
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Customers can view own data" ON public.customers;
DROP POLICY IF EXISTS "Customers can update own data" ON public.customers;
DROP POLICY IF EXISTS "Merchants can view own customers" ON public.customers;
CREATE POLICY "Customers can view own data"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Customers can update own data"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Merchants can view own customers"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));